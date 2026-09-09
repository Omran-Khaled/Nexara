import assert from 'node:assert/strict';
import http from 'node:http';
import { monotonicProgress, progressFromViewport, readLocalProgress, writeLocalProgress, readPreferences, writePreferences } from '../src/reader/readingPersistence';
import { INITIAL_BOOKS } from './fixtures/libraryFixtures';
import { createApp } from '../server/createApp';
import { InMemoryBookRepository } from '../server/repositories/BookRepository';
import { InMemoryAuditLogRepository, InMemoryBookmarkRepository, InMemoryCollectionRepository, InMemoryHighlightRepository, InMemoryReadingProgressRepository, InMemoryReviewRepository, InMemoryRightsRepository } from '../server/repositories/LibraryRepositories';

const source = structuredClone(INITIAL_BOOKS[0]);
const longBook = { ...source, id: 'p5-long-arabic-book', slug: 'p5-long-arabic-book', contentAvailability: 'FULL_TEXT' as const, chapters: Array.from({ length: 400 }, (_, index) => ({ id: `p5-ch-${index}`, title: `Chapter ${index + 1}`, titleAr: `الفصل ${index + 1}`, pageNumber: index + 1, content: `English chapter ${index + 1}. `.repeat(40), contentAr: `هذا نص عربي طويل للفصل ${index + 1}. `.repeat(40) })) };
const repository = new InMemoryBookRepository([longBook]);
const app = createApp({ bookRepository: repository, progressRepository: new InMemoryReadingProgressRepository(), bookmarkRepository: new InMemoryBookmarkRepository(), highlightRepository: new InMemoryHighlightRepository(), collectionRepository: new InMemoryCollectionRepository(), reviewRepository: new InMemoryReviewRepository(), rightsRepository: new InMemoryRightsRepository(), auditRepository: new InMemoryAuditLogRepository() });
const server = app.listen(0);
function request(path: string) { const address = server.address(); assert.ok(address && typeof address !== 'string'); return new Promise<{ status: number; body: any }>((resolve, reject) => { const req = http.request({ hostname: '127.0.0.1', port: address.port, path, headers: { 'x-nexara-test-user': 'p5-reader', 'x-nexara-test-role': 'READER' } }, (res) => { const chunks: Buffer[] = []; res.on('data', (chunk) => chunks.push(Buffer.from(chunk))); res.on('end', () => { const raw = Buffer.concat(chunks).toString(); resolve({ status: res.statusCode || 0, body: raw ? JSON.parse(raw) : null }); }); }); req.on('error', reject); req.end(); }); }
const storage = new Map<string, string>();
const fakeStorage = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } };
try {
  assert.equal(progressFromViewport({ scrollTop: 0, scrollHeight: 1000, clientHeight: 500 }), 0);
  assert.equal(progressFromViewport({ scrollTop: 250, scrollHeight: 1000, clientHeight: 500 }), 50);
  assert.equal(progressFromViewport({ scrollTop: 0, scrollHeight: 500, clientHeight: 500 }), 100);
  const oldSnapshot = { bookId: 'p5-long-arabic-book', editionId: 'edition', chapterIndex: 10, scrollPercent: 80, completedPercent: 25, totalSecondsSpent: 600, lastReadAt: '2026-08-17T00:00:00.000Z', completed: false, clientSequence: 8 };
  const staleSnapshot = { ...oldSnapshot, scrollPercent: 10, completedPercent: 10, totalSecondsSpent: 100, clientSequence: 4 };
  const merged = monotonicProgress(oldSnapshot, staleSnapshot);
  assert.equal(merged.scrollPercent, 80); assert.equal(merged.completedPercent, 25); assert.equal(merged.totalSecondsSpent, 600); assert.equal(merged.clientSequence, 8);
  writeLocalProgress(fakeStorage, oldSnapshot); writeLocalProgress(fakeStorage, staleSnapshot); assert.equal(readLocalProgress(fakeStorage, oldSnapshot.bookId)?.scrollPercent, 80);
  writePreferences(fakeStorage, { theme: 'night', fontSize: 22, fontFamily: 'amiri', lineHeight: 2, contentWidth: 680, textAlign: 'right', paragraphSpacing: 28, continuousScroll: true }); assert.equal(readPreferences(fakeStorage).theme, 'night'); assert.equal(readPreferences(fakeStorage).textAlign, 'right');
  const first = await request('/api/books/p5-long-arabic-book/chapters/0'); assert.equal(first.status, 200); assert.match(first.body.data.contentAr, /هذا نص عربي/); assert.equal(first.body.index, 0);
  const middle = await request('/api/books/p5-long-arabic-book/chapters/200'); assert.equal(middle.status, 200); assert.equal(middle.body.data.id, 'p5-ch-200');
  const last = await request('/api/books/p5-long-arabic-book/chapters/399'); assert.equal(last.status, 200); assert.equal(last.body.data.id, 'p5-ch-399');
  const missing = await request('/api/books/p5-long-arabic-book/chapters/400'); assert.equal(missing.status, 404);
  const list = await request('/api/books?limit=1'); assert.equal(list.status, 200); assert.equal(list.body.data[0].id, longBook.id); assert.equal(list.body.data[0].chapterCount, 400); assert.equal(list.body.data[0].chapters[0].content, ''); assert.equal(list.body.data[0].chapters[0].contentAr, '');
  console.log('P5 reader engine gate passed: 400-chapter Arabic book, chapter loading, RTL-ready preferences, resume, monotonic progress, and missing chapter.');
} finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
