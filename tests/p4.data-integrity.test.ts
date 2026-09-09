import assert from 'node:assert/strict';
import { INITIAL_BOOKS } from './fixtures/libraryFixtures';
import { ConflictError, DatabaseError, NotFoundError, ValidationError } from '../server/errors/ApplicationErrors';
import { AuditLogRepository, InMemoryAuditLogRepository, InMemoryBookmarkRepository, InMemoryCollectionRepository, InMemoryReadingProgressRepository, InMemoryRightsRepository } from '../server/repositories/LibraryRepositories';
import { InMemoryBookRepository } from '../server/repositories/BookRepository';
import { AuditService, BookmarkService, CollectionService, ReadingService, RightsService } from '../server/services/LibraryServices';
import { validateBookWrite, validateBookPatch } from '../server/validators/bookValidators';
import { validateProgress, validateRights } from '../server/validators/libraryValidators';

const book = structuredClone(INITIAL_BOOKS[0]);
const userId = 'p4-user';
const editionId = book.editions[0].id;
const progressInput = (sequence: number) => validateProgress({ userId, editionId, currentChapterIndex: 0, currentScrollPercent: sequence * 10, completedPercent: sequence * 10, totalSecondsSpent: sequence * 30, clientSequence: sequence, clientUpdatedAt: '2026-08-16T00:00:00.000Z' });

const auditRepository = new InMemoryAuditLogRepository();
const audit = new AuditService(auditRepository);
const books = new InMemoryBookRepository([book]);
const reading = new ReadingService(books, new InMemoryReadingProgressRepository(), audit);

const progressResults = await Promise.all([
  reading.upsert(book.id, progressInput(1)),
  reading.upsert(book.id, progressInput(3)),
  reading.upsert(book.id, progressInput(2)),
]);
assert.equal(progressResults.map((value) => value.clientSequence).sort((a, b) => a - b).at(-1), 3);
assert.equal((await reading.list(userId, book.id))[0].clientSequence, 3, 'late progress must not overwrite newest sequence');
const repeated = await reading.upsert(book.id, progressInput(3));
assert.equal(repeated.currentChapterIndex, 0, 'same sequence must be idempotent');

const bookmarks = new BookmarkService(books, new InMemoryBookmarkRepository(), audit);
const bookmarkInput = { userId, bookId: book.id, editionId, chapterIndex: 0, progressPercent: 10, title: 'Start' };
await bookmarks.create(bookmarkInput);
await assert.rejects(() => bookmarks.create({ ...bookmarkInput, title: 'Retry' }), (error: unknown) => error instanceof ConflictError);
await assert.rejects(() => bookmarks.create({ ...bookmarkInput, bookId: 'missing-book' }), (error: unknown) => error instanceof NotFoundError);

const collections = new CollectionService(books, new InMemoryCollectionRepository(), audit);
await assert.rejects(() => collections.create({ userId, title: 'Broken', isPublic: false, bookIds: ['missing-book'], colorTheme: '#000' }), (error: unknown) => error instanceof NotFoundError);

const rights = new RightsService(books, new InMemoryRightsRepository(), audit);
const rightsInput = validateRights({ bookId: book.id, editionId, status: 'PUBLIC_DOMAIN', licenseType: 'Public domain', source: 'Registry', evidence: 'Registry record R-1', verificationMethod: 'RIGHTS_DATABASE', territory: 'WORLDWIDE', attribution: 'Registry', verifiedAt: '2026-08-16T00:00:00.000Z' });
const rightsRecord = await rights.create(rightsInput, userId);
assert.equal(rightsRecord.isCurrent, true);
assert.equal(rightsRecord.verificationMethod, 'RIGHTS_DATABASE');
await assert.rejects(() => rights.create(rightsInput, userId), (error: unknown) => error instanceof ConflictError);
assert.throws(() => validateRights({ ...rightsInput, evidence: undefined }), (error: unknown) => error instanceof ValidationError);
assert.throws(() => validateRights({ ...rightsInput, verifiedAt: '2026-08-16' }), (error: unknown) => error instanceof ValidationError);

const auditEntries = await audit.list();
assert.ok(auditEntries.length > 0);
assert.ok(auditEntries.every((entry) => entry.resource && entry.resourceId && entry.status && entry.changeSummary && /^\d{4}-\d{2}-\d{2}T/.test(entry.timestamp)));

const firstVersion = await books.findById(book.id);
assert.ok(firstVersion);
await books.update(book.id, { title: 'Concurrent Winner', updatedAt: '2026-08-16T00:00:01.000Z' }, firstVersion!.updatedAt);
await assert.rejects(() => books.update(book.id, { title: 'Stale Winner' }, firstVersion!.updatedAt), (error: unknown) => String((error as Error).message).includes('STALE_UPDATE'));

const validBook = structuredClone(book);
assert.doesNotThrow(() => validateBookWrite(validBook));
for (const catalogBook of INITIAL_BOOKS) assert.doesNotThrow(() => validateBookWrite(structuredClone(catalogBook)), `catalog invariant failed for ${catalogBook.id}`);
assert.throws(() => validateBookWrite({ ...validBook, contentAvailability: 'UNAVAILABLE', chapters: validBook.chapters }), (error: unknown) => error instanceof ValidationError);
assert.throws(() => validateBookPatch({ expectedUpdatedAt: '2026-08-16' }), (error: unknown) => error instanceof ValidationError);

class FailingBookmarkRepository extends InMemoryBookmarkRepository {
  override async create(): Promise<never> { throw new DatabaseError('Injected database write failure.'); }
}
const failingBookmarks = new BookmarkService(books, new FailingBookmarkRepository(), audit);
await assert.rejects(() => failingBookmarks.create(bookmarkInput), (error: unknown) => error instanceof DatabaseError);
assert.ok((await audit.list()).some((entry) => entry.status === 'FAILED'));

class FailingAuditRepository implements AuditLogRepository {
  async append(): Promise<never> { throw new DatabaseError('Injected audit append failure.'); }
  async list(): Promise<never[]> { return []; }
}
const durableBookmarkStore = new InMemoryBookmarkRepository();
const failingAuditBookmarks = new BookmarkService(books, durableBookmarkStore, new AuditService(new FailingAuditRepository()));
await assert.rejects(() => failingAuditBookmarks.create({ ...bookmarkInput, chapterIndex: 0, title: 'Must not write' }), (error: unknown) => error instanceof DatabaseError);
assert.equal((await durableBookmarkStore.list(userId, book.id)).length, 0, 'business mutation must not begin when PENDING audit cannot be durable');

console.log('P4 data integrity checks passed.');
