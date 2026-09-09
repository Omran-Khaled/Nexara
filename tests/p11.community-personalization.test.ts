import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { INITIAL_BOOKS } from './fixtures/libraryFixtures';
import { ConflictError, NotFoundError } from '../server/errors/ApplicationErrors';
import { InMemoryBookRepository } from '../server/repositories/BookRepository';
import { InMemoryAuditLogRepository, InMemoryCollectionRepository, InMemoryReadingHistoryRepository, InMemoryReadingProgressRepository, InMemoryReviewRepository } from '../server/repositories/LibraryRepositories';
import { AuditService, CollectionService, ReadingService, ReviewService } from '../server/services/LibraryServices';

const personalViewSource = await readFile(new URL('../src/components/personal/MyLibraryView.tsx', import.meta.url), 'utf8');
const communityViewSource = await readFile(new URL('../src/components/community/CommunityView.tsx', import.meta.url), 'utf8');
assert.doesNotMatch(personalViewSource, /Member since|Capsule:|Reflections on Solitude|Reading DNA & Thematic Balance|<span>18<\/span>/);
assert.doesNotMatch(communityViewSource, /likesCount|const \[likes,|const \[userLiked,/);
assert.match(personalViewSource, /readingHistory/);
assert.match(personalViewSource, /updateCollectionBookIds/);
assert.match(communityViewSource, /loadCommunityFeed/);
assert.match(communityViewSource, /toggleReviewLike/);
assert.match(communityViewSource, /addReviewComment/);

const book = structuredClone(INITIAL_BOOKS[0]);
const books = new InMemoryBookRepository([book]);
const audit = new AuditService(new InMemoryAuditLogRepository());
const historyRepository = new InMemoryReadingHistoryRepository();
const reading = new ReadingService(books, new InMemoryReadingProgressRepository(), audit, historyRepository);
const collections = new CollectionService(books, new InMemoryCollectionRepository(), audit);
const reviews = new ReviewService(books, new InMemoryReviewRepository(), audit);
const readerA = 'p11-reader-a';
const readerB = 'p11-reader-b';
const editionId = book.editions[0].id;

const opened = await reading.recordOpened(book.id, readerA, editionId);
assert.equal(opened.event, 'OPENED');
const progress = await reading.upsert(book.id, {
  userId: readerA,
  editionId,
  currentChapterIndex: 0,
  currentScrollPercent: 40,
  completedPercent: 40,
  totalSecondsSpent: 180,
  clientSequence: 1,
  clientUpdatedAt: '2026-08-18T00:00:00.000Z',
});
assert.equal(progress.completedPercent, 40);
const history = await reading.listHistory(readerA);
assert.equal(history.length, 2);
assert.deepEqual(new Set(history.map((entry) => entry.event)), new Set(['OPENED', 'PROGRESS_SAVED']));

const collection = await collections.create({ userId: readerA, title: 'P11 Shelf', description: 'Server-backed membership', isPublic: false, colorTheme: '#687B61', bookIds: [] });
const populatedCollection = await collections.updateBookIds(collection.id, readerA, [book.id]);
assert.deepEqual(populatedCollection.bookIds, [book.id]);
await assert.rejects(() => collections.updateBookIds(collection.id, readerB, []), (error: unknown) => error instanceof NotFoundError);

const review = await reviews.create({ userId: readerA, userName: 'Reader A', userAvatar: '', bookId: book.id, rating: 5, title: 'A persisted review', content: 'This review is stored and visible in the community feed.' });
assert.equal(review.likes, 0);
assert.equal(review.commentsCount, 0);
const like = await reviews.setLike(review.id, readerB, true);
assert.deepEqual(like, { likes: 1, liked: true });
const feedForReaderB = await reviews.listFeed(readerB);
assert.equal(feedForReaderB[0].likedByCurrentUser, true);
const comment = await reviews.createComment(review.id, readerB, 'Reader B', '', { content: 'A persisted contribution to the discussion.' });
assert.equal(comment.reviewId, review.id);
const thread = await reviews.listComments(review.id);
assert.equal(thread.length, 1);
assert.equal(thread[0].content, 'A persisted contribution to the discussion.');
const updatedFeed = await reviews.listFeed(readerB);
assert.equal(updatedFeed[0].commentsCount, 1);
await reviews.setLike(review.id, readerB, false);
assert.equal((await reviews.listFeed(readerB))[0].likes, 0);
await assert.rejects(() => reviews.create({ userId: readerA, userName: 'Reader A', userAvatar: '', bookId: book.id, rating: 4, title: 'Duplicate', content: 'The unique review rule must still apply.' }), (error: unknown) => error instanceof ConflictError);
console.log('P11 community and personalization checks passed.');
