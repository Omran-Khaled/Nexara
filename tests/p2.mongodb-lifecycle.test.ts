import assert from 'node:assert/strict';
import { MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { INITIAL_BOOKS } from './fixtures/libraryFixtures';
import { applyP2Migrations } from '../server/db/migrations';
import { MongoCatalogRepository } from '../server/repositories/CatalogRepository';
import { Book } from '../src/types';

const base = structuredClone(INITIAL_BOOKS[0]);
function makeBook(id: string, slug: string, workId: string, isbn: string): Book {
  const book = structuredClone(base);
  book.id = id;
  book.slug = slug;
  book.workId = workId;
  book.title = `P2 ${id}`;
  book.titleAr = `بي ٢ ${id}`;
  book.editions = book.editions.map((edition, index) => ({ ...edition, id: `${id}-edition-${index}`, isbn: index === 0 ? isbn : undefined, files: edition.files.map((file, fileIndex) => ({ ...file, id: `${id}-edition-${index}-file-${fileIndex}` })) }));
  book.chapters = book.chapters.map((chapter, index) => ({ ...chapter, id: `${id}-chapter-${index}` }));
  return book;
}

const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
const client = new MongoClient(replSet.getUri());
await client.connect();
const db = client.db('nexara-p2-lifecycle');

try {
  const migration = await applyP2Migrations(db);
  assert.equal(migration.applied, true);
  assert.equal((await applyP2Migrations(db)).applied, false, 'Migration must be idempotent.');
  const indexNames = (await db.collection('editions').indexes()).map((index) => index.name);
  assert.ok(indexNames.includes('editions_isbn_unique'));

  const catalog = new MongoCatalogRepository(db);
  const author = { ...structuredClone(INITIAL_BOOKS as any)[0] };
  void author;
  const authorRecord = structuredClone((await import('./fixtures/libraryFixtures')).INITIAL_AUTHORS[0]);
  await catalog.createAuthor(authorRecord);
  await catalog.createWork({
    id: 'p2-work-one', authorId: authorRecord.id, slug: 'p2-work-one', title: 'P2 Work One', titleAr: 'عمل بي ٢ الأول',
    description: 'Canonical work used for P2 lifecycle verification.', descriptionAr: 'عمل معياري لاختبار دورة حياة بي ٢.', primaryLanguage: 'en', publicationYear: 2026,
  });

  const first = makeBook('p2-book-one', 'p2-book-one', 'p2-work-one', '9780000000011');
  await catalog.createBookAggregate(first);
  assert.equal(await db.collection('books').countDocuments({ id: first.id }), 1);
  assert.equal(await db.collection('editions').countDocuments({ bookId: first.id }), first.editions.length);
  assert.equal(await db.collection('book_files').countDocuments({ bookId: first.id }), 0, 'Catalogue file descriptors must not create physical records without a verified storage upload.');
  assert.equal(await db.collection('chapters').countDocuments({ bookId: first.id }), first.chapters.length);

  await assert.rejects(
    () => catalog.createBookAggregate({ ...makeBook('p2-orphan', 'p2-orphan', 'p2-work-one', '9780000000012'), authorId: 'missing-author' }),
    /Author|author/i,
    'Unknown author references must be rejected.',
  );
  await assert.rejects(
    () => catalog.createBookAggregate({ ...makeBook('p2-illegal', 'p2-illegal', 'p2-work-one', '9780000000013'), contentAvailability: 'METADATA_ONLY' }),
    /Request validation failed/i,
    'Metadata-only books cannot carry readable text.',
  );
  await catalog.createWork({
    id: 'p2-work-two', authorId: authorRecord.id, slug: 'p2-work-two', title: 'P2 Work Two', titleAr: 'عمل بي ٢ الثاني',
    description: 'Second work used for duplicate ISBN validation.', descriptionAr: 'عمل ثانٍ لاختبار منع تكرار ردمك.', primaryLanguage: 'en', publicationYear: 2026,
  });
  await assert.rejects(
    () => catalog.createBookAggregate(makeBook('p2-book-duplicate-isbn', 'p2-book-duplicate-isbn', 'p2-work-two', '9780000000011')),
    /duplicate|E11000/i,
    'Global ISBN uniqueness must be enforced.',
  );

  const revised = structuredClone(first);
  revised.description = 'Updated canonical description.';
  revised.editions = revised.editions.map((edition, index) => ({ ...edition, files: index === 0 ? edition.files.slice(0, 1) : [] }));
  await catalog.replaceBookAggregate(revised);
  assert.equal((await db.collection('books').findOne({ id: first.id }))?.description, 'Updated canonical description.');
  assert.equal(await db.collection('book_files').countDocuments({ bookId: first.id }), 0, 'Replacing catalogue metadata must not manufacture files; physical-file preservation is tested separately.');

  const user = { id: 'p2-user-one', email: 'p2-user@example.test', role: 'READER', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await db.collection('users').insertOne(user);
  const editionId = revised.editions[0].id;
  await db.collection('reading_progress').insertOne({ id: 'p2-progress', userId: user.id, bookId: revised.id, editionId, currentChapterIndex: 0, currentScrollPercent: 10, completedPercent: 10, totalSecondsSpent: 30, lastReadAt: new Date().toISOString(), clientSequence: 1, clientUpdatedAt: new Date().toISOString() });
  await assert.rejects(
    () => db.collection('reading_progress').insertOne({ id: 'p2-progress-duplicate', userId: user.id, bookId: revised.id, editionId, currentChapterIndex: 0, currentScrollPercent: 20, completedPercent: 20, totalSecondsSpent: 60, lastReadAt: new Date().toISOString(), clientSequence: 2, clientUpdatedAt: new Date().toISOString() }),
    /E11000/,
    'Only one reading progress record may exist per user/book/edition.',
  );
  await db.collection('reviews').insertOne({ id: 'p2-review', userId: user.id, userName: 'P2 User', userAvatar: '', bookId: revised.id, rating: 5, title: 'Verified', content: 'This is a verified lifecycle test review.', isVerifiedReader: true, createdAt: new Date().toISOString() });
  await assert.rejects(
    () => db.collection('reviews').insertOne({ id: 'p2-review-duplicate', userId: user.id, userName: 'P2 User', userAvatar: '', bookId: revised.id, rating: 4, title: 'Duplicate', content: 'Duplicate review should be rejected.', isVerifiedReader: true, createdAt: new Date().toISOString() }),
    /E11000/,
    'Only one review may exist per user/book.',
  );
  await db.collection('rights_records').insertOne({ id: 'p2-rights', bookId: revised.id, editionId, status: 'PUBLIC_DOMAIN', licenseType: 'Registry', source: 'P2 test registry', evidence: 'P2 evidence', verificationMethod: 'MANUAL_REVIEW', territory: 'WORLDWIDE', attribution: 'P2 attribution', verifiedAt: new Date().toISOString(), isCurrent: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  await db.collection('collections').insertOne({ id: 'p2-collection', userId: user.id, title: 'P2 collection', description: '', isPublic: false, bookIds: [revised.id], colorTheme: '#123456', createdAt: new Date().toISOString() });

  await assert.rejects(() => catalog.deleteWork('p2-work-one'), /Work/i, 'A work must not be deleted while a book references it.');
  assert.equal(await catalog.deleteBookAggregate(revised.id), true);
  assert.equal(await db.collection('books').countDocuments({ id: revised.id }), 0);
  assert.equal(await db.collection('editions').countDocuments({ bookId: revised.id }), 0);
  assert.equal(await db.collection('book_files').countDocuments({ bookId: revised.id }), 0);
  assert.equal(await db.collection('chapters').countDocuments({ bookId: revised.id }), 0);
  assert.equal(await db.collection('reading_progress').countDocuments({ bookId: revised.id }), 0);
  assert.equal(await db.collection('reviews').countDocuments({ bookId: revised.id }), 0);
  assert.equal(await db.collection('rights_records').countDocuments({ bookId: revised.id }), 0);
  assert.deepEqual((await db.collection<{ bookIds: string[] }>('collections').findOne({ id: 'p2-collection' }))?.bookIds, []);
  assert.equal(await catalog.deleteWork('p2-work-one'), true);
  assert.equal(await catalog.deleteWork('p2-work-two'), true);
  assert.equal(await catalog.deleteAuthor(authorRecord.id), true);

  console.log('P2 MongoDB migration, index, integrity, CRUD, and reference lifecycle checks passed.');
} finally {
  await client.close();
  await replSet.stop();
}
