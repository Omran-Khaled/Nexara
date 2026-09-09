import assert from 'node:assert/strict';
import http from 'node:http';
import { INITIAL_BOOKS } from './fixtures/libraryFixtures';
import { createApp } from '../server/createApp';
import { InMemoryBookRepository } from '../server/repositories/BookRepository';
import { InMemoryAuditLogRepository, InMemoryBookmarkRepository, InMemoryCollectionRepository, InMemoryHighlightRepository, InMemoryReadingProgressRepository, InMemoryReviewRepository, InMemoryRightsRepository } from '../server/repositories/LibraryRepositories';
const book = structuredClone(INITIAL_BOOKS[0]);
const repository = new InMemoryReadingProgressRepository();
const app = createApp({ bookRepository: new InMemoryBookRepository([book]), progressRepository: repository, bookmarkRepository: new InMemoryBookmarkRepository(), highlightRepository: new InMemoryHighlightRepository(), collectionRepository: new InMemoryCollectionRepository(), reviewRepository: new InMemoryReviewRepository(), rightsRepository: new InMemoryRightsRepository(), auditRepository: new InMemoryAuditLogRepository() });
const server = app.listen(0);
function put(path: string, body: unknown) { const address = server.address(); assert.ok(address && typeof address !== 'string'); return new Promise<any>((resolve, reject) => { const payload = JSON.stringify(body); const req = http.request({ hostname: '127.0.0.1', port: address.port, path, method: 'PUT', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload), 'x-nexara-test-user': 'monotonic-user', 'x-nexara-test-role': 'READER' } }, (res) => { const chunks: Buffer[] = []; res.on('data', (chunk) => chunks.push(Buffer.from(chunk))); res.on('end', () => resolve({ status: res.statusCode || 0, body: JSON.parse(Buffer.concat(chunks).toString()) })); }); req.on('error', reject); req.write(payload); req.end(); }); }
try {
  const editionId = book.editions[0].id;
  const path = `/api/reading-progress/${book.id}`;
  const newest = await put(path, { userId: 'monotonic-user', editionId, currentChapterIndex: 0, currentScrollPercent: 90, completedPercent: 95, totalSecondsSpent: 900, clientSequence: 10, clientUpdatedAt: '2026-08-18T00:00:10.000Z' });
  assert.equal(newest.status, 200); assert.equal(newest.body.data.clientSequence, 10); assert.equal(newest.body.data.currentScrollPercent, 90);
  const stale = await put(path, { userId: 'monotonic-user', editionId, currentChapterIndex: 0, currentScrollPercent: 5, completedPercent: 5, totalSecondsSpent: 10, clientSequence: 9, clientUpdatedAt: '2026-08-18T00:00:09.000Z' });
  assert.equal(stale.status, 200); assert.equal(stale.body.data.clientSequence, 10); assert.equal(stale.body.data.currentScrollPercent, 90); assert.equal(stale.body.data.currentChapterIndex, 0);
  console.log('P5 server monotonic progress gate passed.');
} finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
