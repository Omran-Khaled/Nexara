import assert from 'node:assert/strict';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { applyP4BookFileMigration } from '../server/db/migrations';

const main = async () => {
  const mongo = await MongoMemoryServer.create();
  const client = new MongoClient(mongo.getUri());
  try {
    await client.connect();
    const db = client.db('p4');
    const first = await applyP4BookFileMigration(db);
    assert.equal(first.migrationId, 'p4-real-book-file-storage-v1');
    const second = await applyP4BookFileMigration(db);
    assert.equal(second.applied, false);
    await db.collection('book_files').insertOne({ id: 'file-1', bookId: 'book-1', editionId: 'edition-1', format: 'PDF', mimeType: 'application/pdf', storageKey: 'books/book-1/editions/edition-1/files/file-1', sizeBytes: 4, checksum: 'abcd', storageProvider: 's3-compatible', downloadAllowed: true, readingAllowed: true, offlineAllowed: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), verifiedAt: new Date().toISOString() });
    await assert.rejects(() => db.collection('book_files').insertOne({ id: 'file-invalid', bookId: 'book-1', editionId: 'edition-1', format: 'PDF' }));
    console.log('P4 MongoDB migration gate passed.');
  } finally { await client.close(); await mongo.stop(); }
};
main().catch((error) => { console.error(error); process.exitCode = 1; });
