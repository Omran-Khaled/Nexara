import assert from 'node:assert/strict';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { applyP6AuthorizedDownloadMigration } from '../server/db/migrations';
import { MongoCatalogRepository } from '../server/repositories/CatalogRepository';
import { INITIAL_AUTHORS, INITIAL_BOOKS } from './fixtures/libraryFixtures';

const main = async () => {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const client = new MongoClient(replSet.getUri());
  try {
    await client.connect();
    const db = client.db('p4-catalog-file-isolation');
    await applyP6AuthorizedDownloadMigration(db);
    const catalog = new MongoCatalogRepository(db);
    const author = structuredClone(INITIAL_AUTHORS[0]);
    const book = structuredClone(INITIAL_BOOKS[0]);
    book.id = 'isolation-book'; book.slug = 'isolation-book'; book.workId = 'isolation-work'; book.authorId = author.id; book.authorName = author.name; book.authorNameAr = author.nameAr;
    book.editions = book.editions.map((edition, index) => ({ ...edition, id: `isolation-edition-${index}`, files: edition.files.map((file, fileIndex) => ({ ...file, id: `metadata-stub-${index}-${fileIndex}` })) }));
    book.chapters = book.chapters.map((chapter, index) => ({ ...chapter, id: `isolation-chapter-${index}` }));
    await catalog.upsertAuthor(author);
    await catalog.upsertWork({ id: 'isolation-work', authorId: author.id, slug: 'isolation-work', title: 'Isolation Work', titleAr: 'عمل العزل', description: 'Catalogue storage isolation test.', descriptionAr: 'اختبار عزل تخزين الكتالوج.', primaryLanguage: 'en', publicationYear: 2026 });
    await catalog.createBookAggregate(book);
    assert.equal(await db.collection('book_files').countDocuments({ bookId: book.id }), 0, 'Inline catalogue stubs must not become physical files.');
    const physical = { id: 'physical-file', bookId: book.id, editionId: book.editions[0].id, format: 'PDF', mimeType: 'application/pdf', storageKey: 'books/isolation-book/physical-file', sizeBytes: 4, checksum: 'deadbeef', storageProvider: 's3-compatible', downloadAllowed: true, readingAllowed: true, offlineAllowed: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), verifiedAt: new Date().toISOString() };
    await db.collection('book_files').insertOne(physical);
    const revised = { ...book, title: 'Updated without deleting stored file' };
    await catalog.replaceBookAggregate(revised);
    assert.equal(await db.collection('book_files').countDocuments({ id: physical.id }), 1, 'Catalogue replacement must never delete a real stored file.');
    const storedBook = await db.collection('books').findOne({ id: book.id });
    assert.equal(storedBook?.editions?.flatMap((edition: { files?: unknown[] }) => edition.files || []).length, 0, 'Book projection must not advertise inline fake files.');
    console.log('P4 catalogue/file isolation gate passed.');
  } finally { await client.close(); await replSet.stop(); }
};
main().catch((error) => { console.error(error); process.exitCode = 1; });
