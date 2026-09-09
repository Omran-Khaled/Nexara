import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { Book } from '../src/types';
import { INITIAL_BOOKS } from './fixtures/libraryFixtures';

export type TestIdentity = {
  id: string;
  role?: 'READER' | 'MODERATOR' | 'EDITOR' | 'ADMIN';
  territory?: string;
};

export type HttpResult = {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
  json: any;
};

export function p14Book(overrides: Partial<Book> = {}): Book {
  const base = structuredClone(INITIAL_BOOKS[0]);
  const id = overrides.id || 'p14-real-book';
  const editionId = `edition-${id}`;
  const chapters = base.chapters.slice(0, 2).map((chapter, index) => ({
    ...chapter,
    id: `${id}-chapter-${index + 1}`,
    title: index === 0 ? 'P14 Opening Chapter' : 'P14 Second Chapter',
    titleAr: index === 0 ? 'فصل P14 الافتتاحي' : 'فصل P14 الثاني',
  }));
  const book: Book = {
    ...base,
    id,
    workId: overrides.workId || `work-${id}`,
    slug: overrides.slug || id,
    title: overrides.title || 'P14 Real Verified Book',
    titleAr: overrides.titleAr || 'كتاب P14 الحقيقي الموثق',
    authorId: overrides.authorId || 'author-p14',
    authorName: overrides.authorName || 'P14 Test Author',
    authorNameAr: overrides.authorNameAr || 'مؤلف اختبار P14',
    contentAvailability: 'FULL_TEXT',
    workflowStatus: 'PUBLISHED',
    editions: [{
      ...base.editions[0],
      id: editionId,
      isbn: `9780000${String(Math.abs(hashNumber(id))).padStart(6, '0').slice(0, 6)}`,
      rightsStatus: 'PUBLIC_DOMAIN',
      licenseType: 'Public Domain',
      territoryRestrictions: ['WORLDWIDE'],
      source: 'P14 verified public-domain archive',
      attribution: 'P14 integration fixture attribution',
      files: [],
    }],
    chapters,
    createdAt: '2026-08-18T00:00:00.000Z',
    updatedAt: '2026-08-18T00:00:00.000Z',
    ...overrides,
  };
  return book;
}

function hashNumber(value: string): number {
  return [...value].reduce((accumulator, char) => ((accumulator * 33) + char.charCodeAt(0)) >>> 0, 5381) % 1_000_000;
}

export function sha256(body: Buffer): string {
  return createHash('sha256').update(body).digest('hex');
}

export function identityHeaders(identity?: TestIdentity): Record<string, string> {
  if (!identity) return {};
  return {
    'x-nexara-test-user': identity.id,
    'x-nexara-test-role': identity.role || 'READER',
    ...(identity.territory ? { 'x-nexara-test-territory': identity.territory } : {}),
  };
}

export async function request(
  server: http.Server,
  method: string,
  path: string,
  options: { body?: unknown; headers?: Record<string, string>; identity?: TestIdentity } = {},
): Promise<HttpResult> {
  const address = server.address();
  assert.ok(address && typeof address !== 'string', 'Test server must be listening on a TCP address.');
  const isBinary = Buffer.isBuffer(options.body);
  const payload: Buffer | undefined = options.body === undefined ? undefined : isBinary ? options.body as Buffer : Buffer.from(JSON.stringify(options.body));
  const headers: Record<string, string> = {
    ...identityHeaders(options.identity),
    ...(payload && !isBinary ? { 'content-type': 'application/json' } : {}),
    ...(payload ? { 'content-length': String(payload.byteLength) } : {}),
    ...(options.headers || {}),
  };
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: address.port, method, path, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        const text = body.toString('utf8');
        let json: any = null;
        try { json = text ? JSON.parse(text) : null; } catch { /* Binary response by design. */ }
        resolve({ status: res.statusCode || 0, headers: res.headers, body, json });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

export async function close(server: http.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

export async function uploadBookFile(
  server: http.Server,
  bookId: string,
  editionId: string,
  body: Buffer,
  format: 'PDF' | 'EPUB' | 'TXT' = 'PDF',
  identity: TestIdentity = { id: 'p14-admin', role: 'ADMIN', territory: 'US' },
): Promise<{ id: string; checksum: string; sizeBytes: number }> {
  const mimeType = format === 'PDF' ? 'application/pdf' : format === 'EPUB' ? 'application/epub+zip' : 'text/plain';
  const response = await request(server, 'POST', `/api/books/${bookId}/editions/${editionId}/files`, {
    body,
    headers: {
      'content-type': mimeType,
      'x-file-format': format,
      'x-source-url': 'https://example.test/p14-source',
      'x-download-allowed': 'true',
      'x-reading-allowed': 'true',
      'x-offline-allowed': 'true',
    },
    identity,
  });
  assert.equal(response.status, 201, response.body.toString('utf8'));
  return response.json.data;
}

export function verifiedTextSource(externalId: string) {
  const paragraph = 'This is a verified public-domain source paragraph for the P14 master testing gate. It contains sufficient readable prose to make deterministic chapter extraction meaningful and to prove the ingestion pipeline validates, persists, and publishes a reader-visible work. ';
  const content = Buffer.from(`${paragraph.repeat(4)}\n\n${paragraph.repeat(4)}`, 'utf8');
  return {
    provider: 'Gutenberg' as const,
    externalId,
    title: `P14 Ingestion Book ${externalId}`,
    authors: ['P14 Ingestion Author'],
    subjects: ['Literature', 'Public domain'],
    language: 'en',
    sourceUrl: `https://www.gutenberg.org/ebooks/${externalId}`,
    rights: {
      rightsStatus: 'PUBLIC_DOMAIN' as const,
      licenseType: 'Project Gutenberg public-domain distribution',
      evidence: 'P14 fixture: provider asserted a public-domain record and a verified source file.',
      verificationMethod: 'PROVIDER_ASSERTION' as const,
      territory: 'WORLDWIDE',
      source: `https://www.gutenberg.org/files/${externalId}/${externalId}-0.txt`,
      attribution: `Project Gutenberg eBook #${externalId}, P14 fixture.`,
      permalink: `https://www.gutenberg.org/ebooks/${externalId}`,
      rightsEvidenceUrl: `https://www.gutenberg.org/ebooks/${externalId}`,
      verifiedAt: '2026-08-18T00:00:00.000Z',
    },
    content: {
      data: content,
      mimeType: 'text/plain; charset=utf-8' as const,
      sourceUrl: `https://www.gutenberg.org/files/${externalId}/${externalId}-0.txt`,
    },
  };
}
