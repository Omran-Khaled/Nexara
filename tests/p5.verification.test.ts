import assert from 'node:assert/strict';
import http from 'node:http';
import { INITIAL_BOOKS } from './fixtures/libraryFixtures';
import { createApp } from '../server/createApp';
import { DiscoveryService } from '../server/discovery/DiscoveryService';
import { DiscoveryProvider } from '../server/discovery/types';
import { InMemoryBookRepository } from '../server/repositories/BookRepository';
import { InMemoryAuditLogRepository, InMemoryBookmarkRepository, InMemoryCollectionRepository, InMemoryHighlightRepository, InMemoryReadingProgressRepository, InMemoryReviewRepository, InMemoryRightsRepository } from '../server/repositories/LibraryRepositories';
import { canOpenInReader, contentAvailabilityLabel, isFullTextDownloadAllowed, readerUnavailableMessage } from '../src/lib/contentIntegrity';

const book = structuredClone(INITIAL_BOOKS[0]);
const userId = 'p5-critical-user';
const editionId = book.editions[0].id;

async function request(server: http.Server, method: string, path: string, body?: unknown) {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: address.port, path, method, headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), 'x-nexara-test-user': userId, 'x-nexara-test-role': 'ADMIN' } }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => resolve({ status: res.statusCode || 0, body: raw ? JSON.parse(raw) : undefined }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

const provider: DiscoveryProvider = {
  name: 'Heritage',
  timeoutMs: 100,
  async search(query) {
    return [{ externalId: 'p5-heritage-1', title: `${query} Result`, author: 'P5 Author', contentAvailability: 'METADATA_ONLY', rightsStatus: 'UNAVAILABLE', rightsVerification: 'UNVERIFIED', previewStatus: 'NONE' }];
  },
};

const app = createApp({
  bookRepository: new InMemoryBookRepository([book]),
  progressRepository: new InMemoryReadingProgressRepository(),
  bookmarkRepository: new InMemoryBookmarkRepository(),
  highlightRepository: new InMemoryHighlightRepository(),
  collectionRepository: new InMemoryCollectionRepository(),
  reviewRepository: new InMemoryReviewRepository(),
  rightsRepository: new InMemoryRightsRepository(),
  auditRepository: new InMemoryAuditLogRepository(),
  discoveryService: new DiscoveryService([provider]),
});
const server = app.listen(0);
try {
  const list = await request(server, 'GET', '/api/books?limit=1');
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.body.data));
  assert.equal(typeof list.body.total, 'number');
  const existingId = list.body.data[0].id;

  const invalid = await request(server, 'GET', '/api/discovery/search?q=&limit=20');
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, 'DISCOVERY_QUERY_REQUIRED');
  assert.equal(typeof invalid.body.error.message, 'string');

  const missing = await request(server, 'GET', '/api/books/missing-book');
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.code, 'NOT_FOUND');

  const duplicateBook = await request(server, 'POST', '/api/books', book);
  assert.equal(duplicateBook.status, 409);
  assert.equal(duplicateBook.body.error.code, 'CONFLICT');

  const progress = await request(server, 'PUT', `/api/reading-progress/${existingId}`, { userId, editionId, currentChapterIndex: 0, currentScrollPercent: 20, completedPercent: 20, totalSecondsSpent: 60, clientSequence: 1, clientUpdatedAt: '2026-08-16T00:00:00.000Z' });
  assert.equal(progress.status, 200);
  assert.equal(progress.body.data.clientSequence, 1);

  const bookmarkBody = { userId, bookId: existingId, editionId, chapterIndex: 0, progressPercent: 20, title: 'P5 bookmark' };
  const bookmark = await request(server, 'POST', '/api/bookmarks', bookmarkBody);
  assert.equal(bookmark.status, 201);
  const bookmarkDuplicate = await request(server, 'POST', '/api/bookmarks', bookmarkBody);
  assert.equal(bookmarkDuplicate.status, 409);

  const highlight = await request(server, 'POST', '/api/highlights', { userId, bookId: existingId, chapterIndex: 0, selectedText: 'Critical reader text', color: 'gold', note: 'P5' });
  assert.equal(highlight.status, 201);
  const note = await request(server, 'PATCH', `/api/highlights/${highlight.body.data.id}/note?userId=${userId}`, { note: 'Updated P5 note' });
  assert.equal(note.status, 200);
  assert.equal(note.body.data.note, 'Updated P5 note');

  const collectionBody = { userId, title: 'P5 Collection', isPublic: false, bookIds: [existingId], colorTheme: '#123456' };
  const collection = await request(server, 'POST', '/api/collections', collectionBody);
  assert.equal(collection.status, 201);
  assert.equal((await request(server, 'POST', '/api/collections', collectionBody)).status, 409);

  const reviewBody = { userId, userName: 'P5 Reader', userAvatar: 'https://example.test/avatar', bookId: existingId, rating: 5, title: 'P5 review', content: 'Critical flow verified.' };
  const review = await request(server, 'POST', '/api/reviews', reviewBody);
  assert.equal(review.status, 201);
  assert.equal((await request(server, 'POST', '/api/reviews', reviewBody)).status, 409);

  const rights = await request(server, 'POST', '/api/rights-records?performedBy=p5-admin', { bookId: existingId, editionId, status: 'PUBLIC_DOMAIN', licenseType: 'Registry', source: 'P5 source', evidence: 'P5 evidence', verificationMethod: 'MANUAL_REVIEW', territory: 'WORLDWIDE', attribution: 'P5 attribution', verifiedAt: '2026-08-16T00:00:00.000Z' });
  assert.equal(rights.status, 201);
  assert.equal(rights.body.data.isCurrent, true);

  const audits = await request(server, 'GET', `/api/audit-logs?entityType=BOOK&entityId=${existingId}`);
  assert.equal(audits.status, 200);
  assert.ok(audits.body.data.some((entry: any) => entry.status === 'PENDING'));
  assert.ok(audits.body.data.some((entry: any) => entry.status === 'SUCCESS'));
  assert.ok(audits.body.data.every((entry: any) => entry.resource && entry.resourceId && entry.changeSummary));

  const discovery = await request(server, 'GET', '/api/discovery/search?q=Plato&limit=10');
  assert.equal(discovery.status, 200);
  assert.equal(discovery.body.query, 'Plato');
  assert.ok(Array.isArray(discovery.body.data));
  assert.ok(Array.isArray(discovery.body.providers));
  assert.equal(discovery.body.data[0].contentAvailability, 'METADATA_ONLY');
  assert.ok(discovery.body.data[0].rankingReasons.length > 0);

  assert.equal(canOpenInReader({ contentAvailability: 'FULL_TEXT' }), true);
  assert.equal(canOpenInReader({ contentAvailability: 'PREVIEW' }), true);
  assert.equal(canOpenInReader({ contentAvailability: 'METADATA_ONLY' }), false);
  assert.equal(canOpenInReader({ contentAvailability: 'UNAVAILABLE' }), false);
  assert.equal(isFullTextDownloadAllowed({ contentAvailability: 'PREVIEW' }), false);
  assert.equal(isFullTextDownloadAllowed({ contentAvailability: 'FULL_TEXT' }), true);
  assert.equal(contentAvailabilityLabel('METADATA_ONLY'), 'Metadata only');
  assert.match(readerUnavailableMessage('METADATA_ONLY'), /metadata only/i);

  console.log('P5 API, reader, and critical-flow verification passed.');
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
