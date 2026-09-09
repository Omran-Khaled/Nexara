import assert from 'node:assert/strict';
import http from 'node:http';
import { INITIAL_BOOKS } from './fixtures/libraryFixtures';
import { createApp } from '../server/createApp';
import { InMemoryBookRepository } from '../server/repositories/BookRepository';
import { InMemoryAuditLogRepository, InMemoryBookmarkRepository, InMemoryCollectionRepository, InMemoryHighlightRepository, InMemoryReadingProgressRepository, InMemoryReviewRepository, InMemoryRightsRepository } from '../server/repositories/LibraryRepositories';
import { BookService } from '../server/services/BookService';
import { validateBookPatch } from '../server/validators/bookValidators';
import { ConflictError, NotFoundError, ValidationError } from '../server/errors/ApplicationErrors';

function cloneBook(index = 0) {
  return structuredClone(INITIAL_BOOKS[index]);
}

async function request(server: http.Server, method: string, path: string, body?: unknown) {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: address.port, path, method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), 'x-nexara-test-user': 'p1-api-user', 'x-nexara-test-role': 'ADMIN' } }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => resolve({ status: res.statusCode || 0, body: raw ? JSON.parse(raw) : undefined }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testRepositoryServiceAndValidation() {
  const repo = new InMemoryBookRepository();
  const service = new BookService(repo);
  const book = cloneBook();
  await service.create(book);
  await assert.rejects(() => service.create(book), (error: unknown) => error instanceof ConflictError);
  assert.equal((await service.get(book.id)).id, book.id);
  await service.update(book.id, { title: 'Updated P1 title' });
  assert.equal((await service.get(book.id)).title, 'Updated P1 title');
  await service.delete(book.id);
  await assert.rejects(() => service.get(book.id), (error: unknown) => error instanceof NotFoundError);
  assert.throws(() => validateBookPatch({ contentAvailability: 'METADATA_ONLY', chapters: [{ id: 'fake' }] }), (error: unknown) => error instanceof ValidationError);
}

async function testApiCrudAndErrors() {
  const repo = new InMemoryBookRepository([cloneBook()]);
  const server = createApp({ bookRepository: repo, progressRepository: new InMemoryReadingProgressRepository(), bookmarkRepository: new InMemoryBookmarkRepository(), highlightRepository: new InMemoryHighlightRepository(), collectionRepository: new InMemoryCollectionRepository(), reviewRepository: new InMemoryReviewRepository(), rightsRepository: new InMemoryRightsRepository(), auditRepository: new InMemoryAuditLogRepository() }).listen(0);
  try {
    const list = await request(server, 'GET', '/api/books?limit=2');
    assert.equal(list.status, 200);
    assert.equal(Array.isArray(list.body.data), true);
    const existingId = list.body.data[0].id;
    const get = await request(server, 'GET', `/api/books/${existingId}`);
    assert.equal(get.status, 200);
    const missing = await request(server, 'GET', '/api/books/missing-book');
    assert.equal(missing.status, 404);
    const invalid = await request(server, 'GET', '/api/books/%%%');
    assert.equal(invalid.status, 400);
    const duplicate = await request(server, 'POST', '/api/books', list.body.data[0]);
    assert.equal(duplicate.status, 409);
    const deleted = await request(server, 'DELETE', `/api/books/${existingId}`);
    assert.equal(deleted.status, 204);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

await testRepositoryServiceAndValidation();
await testApiCrudAndErrors();
console.log('P1 backend checks passed.');
