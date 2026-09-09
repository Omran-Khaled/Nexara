import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../server/createApp';
import { InMemoryBookRepository } from '../server/repositories/BookRepository';
import { InMemoryAuditLogRepository, InMemoryBookmarkRepository, InMemoryCollectionRepository, InMemoryHighlightRepository, InMemoryReadingProgressRepository, InMemoryReviewRepository, InMemoryRightsRepository } from '../server/repositories/LibraryRepositories';
import { LocalStorageProvider, StorageProvider } from '../server/storage/StorageProvider';
import { MemoryBookFileRepository } from '../server/storage/BookFileRepository';
import { Book } from '../src/types';
import { validEpub } from './fixtures/validEpub';

class SwitchableStorageProvider implements StorageProvider {
  readonly name = 'test-source-provider';
  unavailable = false;
  constructor(private readonly delegate: LocalStorageProvider) {}
  put = (...args: Parameters<StorageProvider['put']>) => this.delegate.put(...args);
  get = (...args: Parameters<StorageProvider['get']>) => this.delegate.get(...args);
  delete = (...args: Parameters<StorageProvider['delete']>) => this.delegate.delete(...args);
  signedReadUrl = (...args: Parameters<StorageProvider['signedReadUrl']>) => this.delegate.signedReadUrl(...args);
  async exists(storageKey: string) {
    if (this.unavailable) throw new Error('simulated provider outage');
    return this.delegate.exists(storageKey);
  }
}

function edition(id: string, rightsStatus: 'PUBLIC_DOMAIN' | 'RESTRICTED' = 'PUBLIC_DOMAIN'): Book['editions'][number] {
  return {
    id,
    language: 'en',
    languageName: 'English',
    languageNameAr: 'الإنجليزية',
    publisher: 'Nexara Test Archive',
    publicationYear: 1900,
    pageCount: 10,
    estimatedMinutes: 20,
    rightsStatus,
    licenseType: rightsStatus === 'PUBLIC_DOMAIN' ? 'Public Domain' : 'NO_DOWNLOAD',
    source: 'Nexara verified test archive',
    attribution: 'Verified source attribution',
    territoryRestrictions: ['US'],
    files: [],
  };
}

function book(id: string, editionId: string, rightsStatus: 'PUBLIC_DOMAIN' | 'RESTRICTED' = 'PUBLIC_DOMAIN'): Book {
  return {
    id,
    workId: `work-${id}`,
    slug: id,
    title: `Test book ${id}`,
    titleAr: `كتاب اختبار ${id}`,
    authorId: 'author-test',
    authorName: 'Test Author',
    authorNameAr: 'مؤلف الاختبار',
    coverImage: '/cover.png',
    description: 'P6 test book',
    descriptionAr: 'كتاب اختبار P6',
    genres: ['Test'], genresAr: ['اختبار'], categories: ['Test'], categoriesAr: ['اختبار'], themes: [], themesAr: [], moods: [],
    rating: 0, ratingsCount: 0, reviewsCount: 0, downloadsCount: 0, readsCount: 0,
    featured: false, hiddenGem: false, editorialPick: false, forestRegion: 'archive-woods', forestCoords: { x: 0, y: 0 }, readingDifficulty: 'Accessible', primaryLanguage: 'en', publicationYear: 1900,
    editions: [edition(editionId, rightsStatus)], chapters: [], contentAvailability: 'FULL_TEXT', workflowStatus: 'PUBLISHED', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

function call(server: http.Server, method: string, path: string, body?: Buffer | string, headers: Record<string, string> = {}, identity: 'reader-us' | 'reader-ca' | 'admin-us' | 'none' = 'reader-us') {
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const identityHeaders = identity === 'none' ? {} : {
    'x-nexara-test-user': identity,
    'x-nexara-test-role': identity === 'admin-us' ? 'ADMIN' : 'READER',
    'x-nexara-test-territory': identity === 'reader-ca' ? 'CA' : 'US',
  };
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
    const request = http.request({ hostname: '127.0.0.1', port: address.port, method, path, headers: { ...headers, ...identityHeaders } }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.on('end', () => resolve({ status: response.statusCode || 0, headers: response.headers, body: Buffer.concat(chunks) }));
    });
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

async function upload(server: http.Server, bookId: string, editionId: string, format: 'PDF' | 'EPUB', body: Buffer) {
  const response = await call(server, 'POST', `/api/books/${bookId}/editions/${editionId}/files`, body, {
    'content-type': format === 'PDF' ? 'application/pdf' : 'application/epub+zip',
    'x-file-format': format,
    'x-source-url': 'https://example.org/original',
    'x-download-allowed': 'true',
  }, 'admin-us');
  assert.equal(response.status, 201, response.body.toString());
  return JSON.parse(response.body.toString()).data as { id: string; storageKey: string; sizeBytes: number };
}

const main = async () => {
  const root = await mkdtemp(join(tmpdir(), 'nexara-p6-'));
  const books = new InMemoryBookRepository();
  await books.create(book('book-allowed', 'edition-allowed'));
  await books.create(book('book-restricted', 'edition-restricted', 'RESTRICTED'));
  const audit = new InMemoryAuditLogRepository();
  const local = new LocalStorageProvider(root);
  const storage = new SwitchableStorageProvider(local);
  const files = new MemoryBookFileRepository();
  const app = createApp({
    bookRepository: books,
    progressRepository: new InMemoryReadingProgressRepository(),
    bookmarkRepository: new InMemoryBookmarkRepository(),
    highlightRepository: new InMemoryHighlightRepository(),
    collectionRepository: new InMemoryCollectionRepository(),
    reviewRepository: new InMemoryReviewRepository(),
    rightsRepository: new InMemoryRightsRepository(),
    auditRepository: audit,
    fileRepository: files,
    storageProvider: storage,
  });
  const server = app.listen(0);
  try {
    const original = Buffer.from('%PDF-1.7\nP6 original legal file\n%%EOF');
    const allowedFile = await upload(server, 'book-allowed', 'edition-allowed', 'PDF', original);

    const unauthorized = await call(server, 'POST', `/api/books/book-allowed/editions/edition-allowed/files/${allowedFile.id}/downloads`, JSON.stringify({}), { 'content-type': 'application/json' }, 'none');
    assert.equal(unauthorized.status, 401, 'unauthorized user must be rejected');

    const availability = await call(server, 'GET', '/api/books/book-allowed/editions/edition-allowed/downloads');
    assert.equal(availability.status, 200);
    const availabilityData = JSON.parse(availability.body.toString()).data;
    assert.equal(availabilityData.files.length, 1);
    assert.equal(availabilityData.files[0].format, 'PDF');
    assert.equal(availabilityData.files[0].availability, 'AVAILABLE');
    assert.equal(availabilityData.source, 'Nexara verified test archive');
    assert.equal(availabilityData.attribution, 'Verified source attribution');

    const allowed = await call(server, 'POST', `/api/books/book-allowed/editions/edition-allowed/files/${allowedFile.id}/downloads`, JSON.stringify({ expiresInSeconds: 60 }), { 'content-type': 'application/json', 'x-request-id': 'p6-allowed' });
    assert.equal(allowed.status, 201, allowed.body.toString());
    const issued = JSON.parse(allowed.body.toString()).data;
    assert.match(issued.href, /mode=download/);
    assert.equal(issued.file.sizeBytes, original.length);
    const delivered = await call(server, 'GET', issued.href);
    assert.equal(delivered.status, 200);
    assert.deepEqual(delivered.body, original, 'delivery must contain the uploaded original bytes');
    assert.match(String(delivered.headers['content-disposition']), /attachment/);
    assert.ok((await audit.list('FILE', allowedFile.id)).some((entry) => entry.action === 'DOWNLOAD_AUTHORIZED' && entry.status === 'SUCCESS'));

    const restrictedFile = await upload(server, 'book-restricted', 'edition-restricted', 'PDF', Buffer.from('%PDF-1.7\nrestricted\n%%EOF'));
    const denied = await call(server, 'POST', `/api/books/book-restricted/editions/edition-restricted/files/${restrictedFile.id}/downloads`, JSON.stringify({}), { 'content-type': 'application/json' });
    assert.equal(denied.status, 403, 'restricted edition must never issue a full download');
    assert.ok((await audit.list('FILE', restrictedFile.id)).some((entry) => entry.action === 'DOWNLOAD_DENIED' && entry.status === 'REJECTED'));

    const regionalDenied = await call(server, 'POST', `/api/books/book-allowed/editions/edition-allowed/files/${allowedFile.id}/downloads`, JSON.stringify({}), { 'content-type': 'application/json' }, 'reader-ca');
    assert.equal(regionalDenied.status, 403, 'territory restriction must be enforced');

    const missing = await call(server, 'POST', '/api/books/book-allowed/editions/edition-allowed/files/file-missing/downloads', JSON.stringify({}), { 'content-type': 'application/json' });
    assert.equal(missing.status, 404, 'missing file must not issue a download');

    const shortLived = await call(server, 'POST', `/api/books/book-allowed/editions/edition-allowed/files/${allowedFile.id}/downloads`, JSON.stringify({ expiresInSeconds: 1 }), { 'content-type': 'application/json' });
    assert.equal(shortLived.status, 201);
    const expiredHref = JSON.parse(shortLived.body.toString()).data.href;
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    const expired = await call(server, 'GET', expiredHref);
    assert.equal(expired.status, 403, 'expired authorized URL must be refused');

    const large = validEpub([{ name: 'OEBPS/large.txt', body: Buffer.alloc(16 * 1024 * 1024, 0x61) }]);
    const largeFile = await upload(server, 'book-allowed', 'edition-allowed', 'EPUB', large);
    const largeIssued = await call(server, 'POST', `/api/books/book-allowed/editions/edition-allowed/files/${largeFile.id}/downloads`, JSON.stringify({}), { 'content-type': 'application/json' });
    assert.equal(largeIssued.status, 201, 'large validated file must be authorized');
    assert.equal(JSON.parse(largeIssued.body.toString()).data.file.sizeBytes, large.length);

    const persistedAllowedFile = await files.get('book-allowed', 'edition-allowed', allowedFile.id);
    assert.ok(persistedAllowedFile);
    await writeFile(join(root, persistedAllowedFile.storageKey), Buffer.from('corrupted'));
    const corrupted = await call(server, 'POST', `/api/books/book-allowed/editions/edition-allowed/files/${allowedFile.id}/downloads`, JSON.stringify({}), { 'content-type': 'application/json' });
    assert.equal(corrupted.status, 400, 'corrupted file must not issue a download');
    assert.ok((await audit.list('FILE', allowedFile.id)).some((entry) => entry.action === 'DOWNLOAD_FILE_CORRUPTED'));

    storage.unavailable = true;
    const unavailable = await call(server, 'POST', `/api/books/book-allowed/editions/edition-allowed/files/${largeFile.id}/downloads`, JSON.stringify({}), { 'content-type': 'application/json' });
    assert.equal(unavailable.status, 502, 'source provider outage must be surfaced');
    assert.ok((await audit.list('FILE', largeFile.id)).some((entry) => entry.action === 'DOWNLOAD_SOURCE_UNAVAILABLE' && entry.status === 'FAILED'));

    console.log('P6 book download system gate passed: allowed, denied, missing, expired, unauthorized, large, corrupted, and provider-unavailable cases.');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(root, { recursive: true, force: true });
  }
};

main().catch((error) => { console.error(error); process.exitCode = 1; });
