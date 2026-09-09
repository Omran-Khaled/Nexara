import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/createApp';
import { loadServerConfig } from '../server/config/env';
import { ApplicationError, AuthorizationError, ProviderError, ValidationError } from '../server/errors/ApplicationErrors';
import { GutenbergDownloadService } from '../server/discovery/GutenbergDownloadService';
import { InMemoryBookRepository } from '../server/repositories/BookRepository';
import { InMemoryAuditLogRepository, InMemoryBookmarkRepository, InMemoryCollectionRepository, InMemoryHighlightRepository, InMemoryReadingProgressRepository, InMemoryReviewRepository, InMemoryRightsRepository } from '../server/repositories/LibraryRepositories';
import { UploadSecurityInspector } from '../server/security/FileUploadSecurity';
import { BookFileService } from '../server/services/BookFileService';
import { MemoryBookFileRepository } from '../server/storage/BookFileRepository';
import { LocalStorageProvider } from '../server/storage/StorageProvider';
import { validEpub } from './fixtures/validEpub';

const admin = { id: 'p9-admin', email: null, role: 'ADMIN' as const };
const reader = { id: 'p9-reader', email: null, role: 'READER' as const };
const validPdf = () => Buffer.from('%PDF-1.7\nP9 security test\n%%EOF');
const safeHtml = () => Buffer.from('<!doctype html><html><head><title>P9</title></head><body><p>safe</p></body></html>', 'utf8');

function dependencies() {
  return {
    bookRepository: new InMemoryBookRepository(),
    progressRepository: new InMemoryReadingProgressRepository(),
    bookmarkRepository: new InMemoryBookmarkRepository(),
    highlightRepository: new InMemoryHighlightRepository(),
    collectionRepository: new InMemoryCollectionRepository(),
    reviewRepository: new InMemoryReviewRepository(),
    rightsRepository: new InMemoryRightsRepository(),
    auditRepository: new InMemoryAuditLogRepository(),
  };
}

function call(server: http.Server, method: string, path: string, body?: Buffer | string, headers: Record<string, string> = {}) {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
    const request = http.request({ hostname: '127.0.0.1', port: address.port, method, path, headers }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.on('end', () => resolve({ status: response.statusCode || 0, headers: response.headers, body: Buffer.concat(chunks) }));
    });
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

async function withServer<T>(app: ReturnType<typeof createApp>, run: (server: http.Server) => Promise<T>): Promise<T> {
  const server = app.listen(0);
  try { return await run(server); } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
}

function productionConfigurationTests(): void {
  const base = { NODE_ENV: 'production', SUPABASE_URL: 'https://project.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public-key' } as NodeJS.ProcessEnv;
  assert.throws(() => loadServerConfig(base), /NEXARA_CORS_ORIGINS/);
  const configured = loadServerConfig({ ...base, NEXARA_CORS_ORIGINS: 'https://library.example.com', BOOK_STORAGE_MAX_BYTES: '1048576', BOOK_STORAGE_SIGNED_URL_TTL_SECONDS: '60' });
  assert.deepEqual(configured.corsOrigins, ['https://library.example.com']);
  assert.equal(configured.bookUploadMaxBytes, 1_048_576);
  assert.equal(configured.bookSignedUrlTtlSeconds, 60);
  assert.throws(() => loadServerConfig({ ...base, NEXARA_CORS_ORIGINS: 'http://library.example.com' }), /HTTPS/);
  assert.throws(() => loadServerConfig({ ...base, NEXARA_CORS_ORIGINS: 'https://library.example.com/catalog' }), /exact origin/);
  assert.throws(() => loadServerConfig({ ...base, NEXARA_CORS_ORIGINS: 'https://library.example.com', BOOK_STORAGE_PROVIDER: 's3' }), /S3-compatible storage is incomplete/);
  assert.throws(() => loadServerConfig({ ...base, NEXARA_CORS_ORIGINS: 'https://library.example.com', BOOK_REQUIRE_MALWARE_SCAN: 'true' }), /BOOK_MALWARE_SCANNER/);
  const s3Configured = loadServerConfig({ ...base, NEXARA_CORS_ORIGINS: 'https://library.example.com', BOOK_STORAGE_PROVIDER: 's3', BOOK_STORAGE_BUCKET: 'nexara', BOOK_STORAGE_ENDPOINT: 'https://s3.example.test', BOOK_STORAGE_ACCESS_KEY: 'key', BOOK_STORAGE_SECRET_KEY: 'secret' });
  assert.equal(s3Configured.bookStorage.provider, 's3');
  assert.equal(s3Configured.bookStorage.endpoint, 'https://s3.example.test');
}

async function uploadInspectionTests(): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'nexara-p9-upload-'));
  try {
    const service = new BookFileService(new MemoryBookFileRepository(), new LocalStorageProvider(root));
    const record = await service.upload({ bookId: 'book-p9', editionId: 'edition-p9', format: 'PDF', mimeType: 'application/pdf', body: validPdf(), originalName: 'security.pdf', downloadAllowed: true, readingAllowed: true, offlineAllowed: false }, admin);
    assert.equal(record.contentInspection, 'PASSED');
    assert.equal(record.malwareScanStatus, 'NOT_CONFIGURED');
    await assert.rejects(() => service.upload({ bookId: 'book-p9', editionId: 'edition-p9', format: 'PDF', mimeType: 'application/pdf', body: Buffer.from('not a PDF'), downloadAllowed: true, readingAllowed: true, offlineAllowed: false }, admin), (error: unknown) => error instanceof ValidationError);
    await assert.rejects(() => service.upload({ bookId: 'book-p9', editionId: 'edition-p9', format: 'EPUB', mimeType: 'application/epub+zip', body: Buffer.from([0x50, 0x4b, 0x03, 0x04]), downloadAllowed: true, readingAllowed: true, offlineAllowed: false }, admin), (error: unknown) => error instanceof ValidationError);
    await assert.rejects(() => service.upload({ bookId: 'book-p9', editionId: 'edition-p9', format: 'TXT', mimeType: 'text/plain', body: Buffer.from('hello\0world'), downloadAllowed: true, readingAllowed: true, offlineAllowed: false }, admin), (error: unknown) => error instanceof ValidationError);
    await assert.rejects(() => service.upload({ bookId: 'book-p9', editionId: 'edition-p9', format: 'HTML', mimeType: 'text/html', body: Buffer.from('<!doctype html><html><body><script>alert(1)</script></body></html>'), downloadAllowed: true, readingAllowed: true, offlineAllowed: false }, admin), (error: unknown) => error instanceof ValidationError);
    await assert.rejects(() => service.upload({ bookId: 'book-p9', editionId: 'edition-p9', format: 'PDF', mimeType: 'application/pdf', body: validPdf(), originalName: '../escape.pdf', downloadAllowed: true, readingAllowed: true, offlineAllowed: false }, admin), (error: unknown) => error instanceof ValidationError);
    await assert.rejects(() => service.upload({ bookId: 'book-p9', editionId: 'edition-p9', format: 'EPUB', mimeType: 'application/epub+zip', body: validEpub(), originalName: 'book.pdf', downloadAllowed: true, readingAllowed: true, offlineAllowed: false }, admin), (error: unknown) => error instanceof ValidationError);
    const grant = await service.createGrant(record, reader, 'read', 60);
    await service.stream(record, grant.token, reader, 'read');
    await assert.rejects(() => service.stream(record, grant.token, reader, 'read'), (error: unknown) => error instanceof AuthorizationError);

    const infected = new UploadSecurityInspector({ malwareScanner: { name: 'test-scanner', scan: async () => 'INFECTED' } });
    const infectedService = new BookFileService(new MemoryBookFileRepository(), new LocalStorageProvider(join(root, 'infected')), () => Date.now(), infected);
    await assert.rejects(() => infectedService.upload({ bookId: 'book-p9', editionId: 'edition-p9', format: 'PDF', mimeType: 'application/pdf', body: validPdf(), downloadAllowed: true, readingAllowed: true, offlineAllowed: false }, admin), (error: unknown) => error instanceof ApplicationError && error.code === 'MALWARE_DETECTED');
    const mandatoryWithoutScanner = new UploadSecurityInspector({ requireMalwareScan: true });
    await assert.rejects(() => mandatoryWithoutScanner.inspect({ format: 'PDF', mimeType: 'application/pdf', body: validPdf() }), (error: unknown) => error instanceof ApplicationError && error.code === 'MALWARE_SCANNER_UNAVAILABLE');
    const tinyLimit = new UploadSecurityInspector({ maxBytes: 16 });
    await assert.rejects(() => tinyLimit.inspect({ format: 'PDF', mimeType: 'application/pdf', body: validPdf() }), (error: unknown) => error instanceof ApplicationError && error.statusCode === 413);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function transportAndHeaderTests(): Promise<void> {
  const app = createApp({ ...dependencies(), fileAccessUrlMaxSeconds: 60, security: { nodeEnv: 'production', corsOrigins: ['https://library.example.com'], rateLimitMax: 100, sensitiveRateLimitMax: 100 } });
  await withServer(app, async (server) => {
    const trusted = await call(server, 'GET', '/api/health', undefined, { origin: 'https://library.example.com', 'x-nexara-test-user': 'p9-reader', 'x-nexara-test-role': 'READER' });
    assert.equal(trusted.status, 200);
    assert.equal(trusted.headers['access-control-allow-origin'], 'https://library.example.com');
    assert.equal(trusted.headers['x-content-type-options'], 'nosniff');
    assert.equal(trusted.headers['x-frame-options'], 'DENY');
    assert.equal(trusted.headers['cross-origin-resource-policy'], 'same-origin');
    assert.equal(trusted.headers['strict-transport-security'], 'max-age=31536000; includeSubDomains');
    assert.match(String(trusted.headers['content-security-policy']), /frame-ancestors 'none'/);
    assert.match(String(trusted.headers['cache-control']), /no-store/);

    const preflight = await call(server, 'OPTIONS', '/api/books/book-p9/editions/edition-p9/files', undefined, { origin: 'https://library.example.com', 'access-control-request-method': 'POST' });
    assert.equal(preflight.status, 204);
    assert.match(String(preflight.headers['access-control-allow-headers']), /x-file-name/);

    const deniedOrigin = await call(server, 'GET', '/api/health', undefined, { origin: 'https://attacker.example' });
    assert.equal(deniedOrigin.status, 403);
    const csrfBlocked = await call(server, 'POST', '/api/books/book-p9/editions/edition-p9/files', validPdf(), { origin: 'https://attacker.example', 'content-type': 'application/pdf', 'x-file-format': 'PDF', 'x-nexara-test-user': 'p9-admin', 'x-nexara-test-role': 'ADMIN' });
    assert.equal(csrfBlocked.status, 403);
    const metadataBlocked = await call(server, 'POST', '/api/books/book-p9/editions/edition-p9/files', validPdf(), { 'sec-fetch-site': 'cross-site', 'content-type': 'application/pdf', 'x-file-format': 'PDF', 'x-nexara-test-user': 'p9-admin', 'x-nexara-test-role': 'ADMIN' });
    assert.equal(metadataBlocked.status, 403);
    const accepted = await call(server, 'POST', '/api/books/book-p9/editions/edition-p9/files', safeHtml(), { origin: 'https://library.example.com', 'content-type': 'text/html', 'x-file-format': 'HTML', 'x-file-name': 'safe.html', 'x-nexara-test-user': 'p9-admin', 'x-nexara-test-role': 'ADMIN' });
    assert.equal(accepted.status, 201, accepted.body.toString());
    const record = JSON.parse(accepted.body.toString()).data;
    const readUrl = await call(server, 'GET', `/api/books/book-p9/editions/edition-p9/files/${record.id}/read-url`, undefined, { 'x-nexara-test-user': 'p9-reader', 'x-nexara-test-role': 'READER' });
    assert.equal(readUrl.status, 200);
    const expiryTooLong = await call(server, 'GET', `/api/books/book-p9/editions/edition-p9/files/${record.id}/read-url?expiresInSeconds=61`, undefined, { 'x-nexara-test-user': 'p9-reader', 'x-nexara-test-role': 'READER' });
    assert.equal(expiryTooLong.status, 400);
    const href = JSON.parse(readUrl.body.toString()).data.href;
    const served = await call(server, 'GET', href, undefined, { 'x-nexara-test-user': 'p9-reader', 'x-nexara-test-role': 'READER' });
    assert.equal(served.status, 200);
    assert.equal(served.headers['content-type'], 'application/octet-stream');
    assert.match(String(served.headers['content-disposition']), /attachment/);
    assert.match(String(served.headers['content-security-policy']), /sandbox/);
  });
}

async function ssrfRedirectTests(): Promise<void> {
  let fileRequestSawManualRedirect = false;
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url.startsWith('https://gutendex.com/books/123')) {
      return new Response(JSON.stringify({ id: 123, title: 'P9 Public Domain Test', copyright: false, formats: { 'text/plain': 'https://www.gutenberg.org/files/123/123.txt' } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    fileRequestSawManualRedirect = init?.redirect === 'manual';
    return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1:8080/internal' } });
  }) as typeof fetch;
  const service = new GutenbergDownloadService(fetchFn);
  await assert.rejects(() => service.download('123', 'txt'), (error: unknown) => error instanceof ProviderError && error.statusCode === 502);
  assert.equal(fileRequestSawManualRedirect, true);

  const requestedUrls: string[] = [];
  const approvedRedirectFetch = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    requestedUrls.push(url);
    if (url.startsWith('https://gutendex.com/books/124')) {
      return new Response(JSON.stringify({ id: 124, title: 'Official Redirect Test', copyright: false, formats: { 'text/plain': 'https://www.gutenberg.org/ebooks/124.txt.utf-8' } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    assert.equal(init?.redirect, 'manual');
    if (url === 'https://www.gutenberg.org/ebooks/124.txt.utf-8') {
      return new Response(null, { status: 302, headers: { location: 'http://www.gutenberg.org/cache/epub/124/pg124.txt' } });
    }
    if (url === 'https://www.gutenberg.org/cache/epub/124/pg124.txt') {
      return new Response('Official Gutenberg text', { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8', 'content-length': '23' } });
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;
  const upgraded = await new GutenbergDownloadService(approvedRedirectFetch).download('124', 'txt');
  assert.equal(upgraded.sourceUrl, 'https://www.gutenberg.org/cache/epub/124/pg124.txt');
  assert.ok(!requestedUrls.includes('http://www.gutenberg.org/cache/epub/124/pg124.txt'));
}

async function rateLimitTests(): Promise<void> {
  const app = createApp({ ...dependencies(), security: { nodeEnv: 'development', rateLimitWindowMs: 60_000, rateLimitMax: 2, sensitiveRateLimitMax: 1 } });
  await withServer(app, async (server) => {
    const readerHeaders = { 'x-nexara-test-user': 'p9-reader', 'x-nexara-test-role': 'READER' };
    assert.equal((await call(server, 'GET', '/api/health', undefined, readerHeaders)).status, 200);
    assert.equal((await call(server, 'GET', '/api/health', undefined, readerHeaders)).status, 200);
    const limited = await call(server, 'GET', '/api/health', undefined, readerHeaders);
    assert.equal(limited.status, 429);
    assert.ok(limited.headers['retry-after']);
  });
}

const main = async () => {
  productionConfigurationTests();
  await uploadInspectionTests();
  await transportAndHeaderTests();
  await ssrfRedirectTests();
  await rateLimitTests();
  console.log('P9 security hardening gate passed: upload validation, malware integration, CORS/CSRF, headers, HTML containment, one-time grants, and rate limiting.');
};
main().catch((error) => { console.error(error); process.exitCode = 1; });
