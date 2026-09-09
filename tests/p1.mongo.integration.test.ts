import assert from 'node:assert/strict';
import http from 'node:http';
import { MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { INITIAL_AUTHORS, INITIAL_BOOKS } from './fixtures/libraryFixtures';
import { createApp } from '../server/createApp';
import { applyP2Migrations } from '../server/db/migrations';
import { MongoBookRepository } from '../server/repositories/MongoBookRepository';
import { MongoCatalogRepository } from '../server/repositories/CatalogRepository';
import { MongoAuditLogRepository, MongoBookmarkRepository, MongoCollectionRepository, MongoHighlightRepository, MongoReadingProgressRepository, MongoReviewRepository, MongoRightsRepository } from '../server/repositories/LibraryRepositories';

const author = structuredClone(INITIAL_AUTHORS[0]);
const workId = 'p1-mongo-work';
function bookFixture(id: string, isbn: string) {
  const book = structuredClone(INITIAL_BOOKS[0]);
  book.id = id; book.workId = workId; book.authorId = author.id; book.authorName = author.name; book.authorNameAr = author.nameAr; book.slug = id; book.title = `Mongo ${id}`; book.titleAr = `مونغو ${id}`; book.workflowStatus = 'EDITORIAL_REVIEW';
  book.editions = book.editions.map((edition, index) => ({ ...edition, id: `${id}-edition-${index}`, isbn: index === 0 ? isbn : undefined, files: edition.files.map((file, fileIndex) => ({ ...file, id: `${id}-edition-${index}-file-${fileIndex}` })) }));
  book.chapters = book.chapters.map((chapter, index) => ({ ...chapter, id: `${id}-chapter-${index}` }));
  return book;
}
async function request(server: http.Server, method: string, path: string, body?: unknown) {
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: address.port, path, method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), 'x-nexara-test-user': 'p1-mongo-user', 'x-nexara-test-role': 'ADMIN' } }, (res) => {
      let raw = ''; res.on('data', (part) => { raw += part; }); res.on('end', () => resolve({ status: res.statusCode || 0, body: raw ? JSON.parse(raw) : undefined }));
    });
    req.on('error', reject); if (body) req.write(JSON.stringify(body)); req.end();
  });
}

const memory = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
const client = new MongoClient(memory.getUri());
await client.connect();
const db = client.db('nexara-strict-p1');
await applyP2Migrations(db);
const catalog = new MongoCatalogRepository(db);
await catalog.createAuthor(author);
await catalog.createWork({ id: workId, authorId: author.id, slug: workId, title: 'P1 Mongo Work', titleAr: 'عمل بي ١ مونغو', description: 'Canonical work for P1 integration regression.', descriptionAr: 'عمل معياري لاختبار انحدار بي ١.', primaryLanguage: 'en', publicationYear: 2026 });
const app = createApp({
  bookRepository: new MongoBookRepository(db), progressRepository: new MongoReadingProgressRepository(db), bookmarkRepository: new MongoBookmarkRepository(db), highlightRepository: new MongoHighlightRepository(db), collectionRepository: new MongoCollectionRepository(db), reviewRepository: new MongoReviewRepository(db), rightsRepository: new MongoRightsRepository(db), auditRepository: new MongoAuditLogRepository(db),
});
const server = app.listen(0);
try {
  const first = bookFixture('mongo-book-one', '9780000000001');
  const second = bookFixture('mongo-book-two', '9780000000001');
  assert.equal((await request(server, 'POST', '/api/books', first)).status, 201);
  assert.equal((await request(server, 'POST', '/api/books', second)).status, 409, 'sparse unique ISBN index must reject duplicate ISBN.');
  assert.equal((await request(server, 'GET', '/api/books/mongo-book-one')).status, 200);
  assert.equal((await request(server, 'PATCH', '/api/books/mongo-book-one', { contentAvailability: 'METADATA_ONLY', chapters: [{ id: 'invalid' }] })).status, 400);

  const userId = 'p1-mongo-user'; const editionId = first.editions[0].id;
  const progress = { userId, editionId, currentChapterIndex: 0, currentScrollPercent: 20, completedPercent: 30, totalSecondsSpent: 60, clientSequence: 1, clientUpdatedAt: '2026-08-16T00:00:00.000Z' };
  assert.equal((await request(server, 'PUT', '/api/reading-progress/mongo-book-one', progress)).status, 200);
  assert.equal((await request(server, 'PUT', '/api/reading-progress/mongo-book-one', { ...progress, currentScrollPercent: 50, completedPercent: 60, totalSecondsSpent: 120, clientSequence: 2, clientUpdatedAt: '2026-08-16T00:01:00.000Z' })).status, 200);
  const late = await request(server, 'PUT', '/api/reading-progress/mongo-book-one', { ...progress, currentScrollPercent: 25, completedPercent: 35, clientSequence: 1, clientUpdatedAt: '2026-08-16T00:00:30.000Z' }); assert.equal(late.status, 200); assert.equal(late.body.data.clientSequence, 2, 'late progress must return the newer stored record.');
  const progressList = await request(server, 'GET', `/api/reading-progress?userId=${userId}`); assert.equal(progressList.status, 200); assert.equal(progressList.body.data.length, 1, 'atomic upsert must preserve one progress record.'); assert.equal(progressList.body.data[0].completedPercent, 60); assert.equal(progressList.body.data[0].clientSequence, 2);
  assert.equal((await request(server, 'PUT', '/api/reading-progress/mongo-book-one', { ...progress, editionId: 'invalid-edition' })).status, 400);

  const bookmarkInput = { userId, bookId: 'mongo-book-one', editionId, chapterIndex: 0, progressPercent: 60, title: 'Mongo chapter' };
  const bookmark = await request(server, 'POST', '/api/bookmarks', bookmarkInput); assert.equal(bookmark.status, 201);
  assert.equal((await request(server, 'POST', '/api/bookmarks', bookmarkInput)).status, 409);
  assert.equal((await request(server, 'DELETE', `/api/bookmarks/${bookmark.body.data.id}?userId=${userId}`)).status, 204);

  const highlight = await request(server, 'POST', '/api/highlights', { userId, bookId: 'mongo-book-one', chapterIndex: 0, selectedText: 'Strict integration text', color: 'gold', note: 'first note' }); assert.equal(highlight.status, 201);
  assert.equal((await request(server, 'PATCH', `/api/highlights/${highlight.body.data.id}/note?userId=${userId}`, { note: 'updated note' })).status, 200);
  assert.equal((await request(server, 'DELETE', `/api/highlights/${highlight.body.data.id}?userId=${userId}`)).status, 204);

  const collectionInput = { userId, title: 'Strict Mongo Shelf', description: 'Integration collection', isPublic: false, bookIds: ['mongo-book-one'], colorTheme: '#687B61' };
  assert.equal((await request(server, 'POST', '/api/collections', collectionInput)).status, 201);
  assert.equal((await request(server, 'POST', '/api/collections', collectionInput)).status, 409);
  assert.equal((await request(server, 'POST', '/api/collections', { ...collectionInput, title: 'Invalid Reference', bookIds: ['missing-book'] })).status, 404);

  const review = await request(server, 'POST', '/api/reviews', { userId, userName: 'P1 Reader', userAvatar: 'https://example.test/avatar', bookId: 'mongo-book-one', rating: 5, title: 'Strict review', content: 'A valid review body.' }); assert.equal(review.status, 201); assert.equal(review.body.data.isVerifiedReader, false);
  assert.equal((await request(server, 'POST', '/api/reviews', { userId, userName: 'P1 Reader', userAvatar: 'https://example.test/avatar', bookId: 'mongo-book-one', rating: 5, title: 'Duplicate', content: 'Duplicate review.' })).status, 409);

  const rights = await request(server, 'POST', '/api/rights-records?performedBy=p1-mongo-user', { bookId: 'mongo-book-one', editionId, status: 'PUBLIC_DOMAIN', licenseType: 'Test License', source: 'Test source', evidence: 'Test evidence document', verificationMethod: 'MANUAL_REVIEW', territory: 'WORLDWIDE', attribution: 'Test attribution', verifiedAt: '2026-08-15T00:00:00.000Z' }); assert.equal(rights.status, 201);
  assert.equal((await request(server, 'GET', '/api/books/mongo-book-one/rights-records')).status, 200);
  const audit = await request(server, 'GET', '/api/audit-logs?entityType=BOOK&entityId=mongo-book-one'); assert.equal(audit.status, 200); assert.ok(audit.body.data.length >= 1, 'mutations must append audit records.');
  console.log('P1 live MongoDB integration checks passed.');
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await client.close();
  await memory.stop();
}
