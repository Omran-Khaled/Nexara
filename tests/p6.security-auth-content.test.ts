import assert from 'node:assert/strict';
import http from 'node:http';
import { INITIAL_BOOKS } from './fixtures/libraryFixtures';
import { createApp } from '../server/createApp';
import { GutenbergDownloadService } from '../server/discovery/GutenbergDownloadService';
import { InMemoryBookRepository } from '../server/repositories/BookRepository';
import { InMemoryAuditLogRepository, InMemoryBookmarkRepository, InMemoryCollectionRepository, InMemoryHighlightRepository, InMemoryReadingProgressRepository, InMemoryReviewRepository, InMemoryRightsRepository } from '../server/repositories/LibraryRepositories';

function deps(auth?: Parameters<typeof createApp>[0]['auth'], security?: Parameters<typeof createApp>[0]['security']) {
  return {
    bookRepository: new InMemoryBookRepository([structuredClone(INITIAL_BOOKS[0])]),
    progressRepository: new InMemoryReadingProgressRepository(),
    bookmarkRepository: new InMemoryBookmarkRepository(),
    highlightRepository: new InMemoryHighlightRepository(),
    collectionRepository: new InMemoryCollectionRepository(),
    reviewRepository: new InMemoryReviewRepository(),
    rightsRepository: new InMemoryRightsRepository(),
    auditRepository: new InMemoryAuditLogRepository(),
    auth,
    security,
  };
}

async function request(server: http.Server, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return new Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }>((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: address.port, path, method, headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers } }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => resolve({ status: res.statusCode || 0, body: raw ? JSON.parse(raw) : undefined, headers: res.headers }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

async function close(server: http.Server) { await new Promise<void>((resolve) => server.close(() => resolve())); }

const unconfigured = createApp(deps({ supabaseUrl: null, supabasePublishableKey: null, allowTestIdentity: false }, { nodeEnv: 'test' }));
const unconfiguredServer = unconfigured.listen(0);
try {
  const privateRead = await request(unconfiguredServer, 'GET', '/api/bookmarks');
  assert.equal(privateRead.status, 401);
  assert.equal(privateRead.body.error.code, 'UNAUTHENTICATED');
  const privateWrite = await request(unconfiguredServer, 'POST', '/api/books', structuredClone(INITIAL_BOOKS[0]));
  assert.equal(privateWrite.status, 401);
  assert.equal(privateWrite.body.error.code, 'UNAUTHENTICATED');
  assert.equal(privateWrite.headers['x-powered-by'], undefined);
  assert.equal(privateWrite.headers['x-content-type-options'], 'nosniff');
} finally { await close(unconfiguredServer); }

const readerApp = createApp(deps({ supabaseUrl: null, supabasePublishableKey: null, allowTestIdentity: true, testRole: 'READER' }, { nodeEnv: 'development', corsOrigins: ['https://library.example.test'] }));
const readerServer = readerApp.listen(0);
try {
  const book = structuredClone(INITIAL_BOOKS[0]);
  const forbiddenAdmin = await request(readerServer, 'POST', '/api/books', book, { 'x-nexara-test-user': 'alice' });
  assert.equal(forbiddenAdmin.status, 403);
  const bookmark = await request(readerServer, 'POST', '/api/bookmarks', { userId: 'victim-user', bookId: book.id, editionId: book.editions[0].id, chapterIndex: 0, progressPercent: 0, title: 'Owned by Alice' }, { 'x-nexara-test-user': 'alice' });
  assert.equal(bookmark.status, 201);
  assert.equal(bookmark.body.data.userId, 'alice');
  const exposed = await request(readerServer, 'GET', '/api/bookmarks?userId=alice', undefined, { 'x-nexara-test-user': 'bob' });
  assert.equal(exposed.status, 200);
  assert.equal(exposed.body.data.length, 0);
  const deniedOrigin = await request(readerServer, 'GET', '/api/books', undefined, { origin: 'https://evil.example' });
  assert.equal(deniedOrigin.status, 403);
} finally { await close(readerServer); }

let calls = 0;
const validService = new GutenbergDownloadService(async (url) => {
  calls += 1;
  if (url.includes('gutendex.com/books/1342')) {
    return new Response(JSON.stringify({ id: 1342, title: 'Pride and Prejudice', copyright: false, formats: { 'text/plain; charset=utf-8': 'https://www.gutenberg.org/files/1342/1342-0.txt' } }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return new Response('Project Gutenberg public-domain full text', { status: 200, headers: { 'content-type': 'text/plain', 'content-length': '42' } });
});
const download = await validService.download('1342', 'txt');
assert.equal(calls, 2);
assert.equal(download.filename, 'pride-and-prejudice-1342.txt');
assert.match(download.data.toString('utf8'), /public-domain full text/i);
assert.match(download.sourceUrl, /gutenberg\.org/);

const copyrightedService = new GutenbergDownloadService(async () => new Response(JSON.stringify({ id: 1, title: 'Restricted Work', copyright: true, formats: { 'text/plain': 'https://www.gutenberg.org/files/1/1.txt' } }), { status: 200, headers: { 'content-type': 'application/json' } }));
await assert.rejects(() => copyrightedService.download('1', 'txt'));

const unsafeHostService = new GutenbergDownloadService(async () => new Response(JSON.stringify({ id: 2, title: 'Unsafe Host', copyright: false, formats: { 'text/plain': 'https://evil.example/book.txt' } }), { status: 200, headers: { 'content-type': 'application/json' } }));
await assert.rejects(() => unsafeHostService.download('2', 'txt'));

console.log('P6 security, ownership, CORS, and public-domain download checks passed.');
