import assert from 'node:assert/strict';
import http from 'node:http';
import { INITIAL_BOOKS } from './fixtures/libraryFixtures';
import { createApp } from '../server/createApp';
import { InMemoryBookRepository } from '../server/repositories/BookRepository';
import { InMemoryAuditLogRepository, InMemoryBookmarkRepository, InMemoryCollectionRepository, InMemoryHighlightRepository, InMemoryReadingProgressRepository, InMemoryReviewRepository, InMemoryRightsRepository } from '../server/repositories/LibraryRepositories';
import { RuntimeRepository } from '../server/repositories/RuntimeRepositories';
import { DownloadRecord, UserAchievementRecord, UserBookStateRecord, UserNotificationRecord, UserTimeCapsuleRecord } from '../server/models/runtime';
import { Author, ReadingPath } from '../src/types';

class TestRuntimeRepository implements RuntimeRepository {
  readonly states: UserBookStateRecord[] = [];
  readonly capsules: UserTimeCapsuleRecord[] = [];
  async listAuthors(): Promise<Author[]> { return []; }
  async listReadingPaths(): Promise<ReadingPath[]> { return []; }
  async listUserBookStates(userId: string) { return this.states.filter((record) => record.userId === userId); }
  async upsertUserBookState(record: UserBookStateRecord) { const index = this.states.findIndex((item) => item.userId === record.userId && item.bookId === record.bookId); if (index >= 0) this.states[index] = record; else this.states.push(record); return record; }
  async listDownloads(_userId: string): Promise<DownloadRecord[]> { return []; }
  async listAchievements(_userId: string): Promise<UserAchievementRecord[]> { return []; }
  async listNotifications(_userId: string): Promise<UserNotificationRecord[]> { return []; }
  async markNotificationRead(_userId: string, _id: string): Promise<UserNotificationRecord | null> { return null; }
  async listTimeCapsules(userId: string) { return this.capsules.filter((record) => record.userId === userId); }
  async createTimeCapsule(record: UserTimeCapsuleRecord) { this.capsules.push(record); return record; }
}

async function request(server: http.Server, method: string, path: string, body?: unknown) {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: address.port, path, method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), 'x-nexara-test-user': 'runtime-api-user', 'x-nexara-test-role': 'READER' } }, (res) => {
      let raw = ''; res.on('data', (chunk) => { raw += chunk; }); res.on('end', () => resolve({ status: res.statusCode || 0, body: raw ? JSON.parse(raw) : undefined }));
    });
    req.on('error', reject); if (body) req.write(JSON.stringify(body)); req.end();
  });
}

const book = structuredClone(INITIAL_BOOKS[0]);
const runtimeRepository = new TestRuntimeRepository();
const server = createApp({
  bookRepository: new InMemoryBookRepository([book]),
  progressRepository: new InMemoryReadingProgressRepository(),
  bookmarkRepository: new InMemoryBookmarkRepository(),
  highlightRepository: new InMemoryHighlightRepository(),
  collectionRepository: new InMemoryCollectionRepository(),
  reviewRepository: new InMemoryReviewRepository(),
  rightsRepository: new InMemoryRightsRepository(),
  auditRepository: new InMemoryAuditLogRepository(),
  runtimeRepository,
}).listen(0);

try {
  const authors = await request(server, 'GET', '/api/authors');
  assert.equal(authors.status, 200);
  assert.deepEqual(authors.body.data, []);

  const before = await request(server, 'GET', '/api/me/runtime-data');
  assert.equal(before.status, 200);
  assert.deepEqual(before.body.data.bookStates, []);
  assert.deepEqual(before.body.data.achievements, []);
  assert.deepEqual(before.body.data.notifications, []);
  assert.deepEqual(before.body.data.timeCapsules, []);

  const state = await request(server, 'PUT', '/api/me/book-states', { bookId: book.id, saved: true, favourite: false, shelf: 'SAVED' });
  assert.equal(state.status, 200);
  assert.equal(state.body.data.userId, 'runtime-api-user');
  assert.equal(state.body.data.saved, true);

  const capsule = await request(server, 'POST', '/api/me/time-capsules', { bookId: book.id, unlockDate: '2030-01-01T00:00:00.000Z', personalNote: 'Read after completing the research programme.' });
  assert.equal(capsule.status, 201);
  assert.equal(capsule.body.data.userId, 'runtime-api-user');

  const after = await request(server, 'GET', '/api/me/runtime-data');
  assert.equal(after.body.data.bookStates.length, 1);
  assert.equal(after.body.data.timeCapsules.length, 1);
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

console.log('P1 runtime API persistence checks passed.');
