import assert from 'node:assert/strict';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { applyP8CurrentMigration } from '../server/db/migrations';

const main = async () => {
  const mongo = await MongoMemoryServer.create();
  const client = new MongoClient(mongo.getUri());
  try {
    await client.connect();
    const db = client.db('p8-auth-migration');
    const first = await applyP8CurrentMigration(db);
    assert.equal(first.migrationId, 'p8-download-log-epub-v1');
    const second = await applyP8CurrentMigration(db);
    assert.equal(second.applied, false, 'Current P8 migration sequence must be idempotent.');
    await db.collection('role_assignments').insertOne({ id: 'role-1', userId: 'supabase-user-1', role: 'MODERATOR', assignedBy: 'bootstrap-admin', createdAt: new Date().toISOString() });
    await assert.rejects(() => db.collection('role_assignments').insertOne({ id: 'role-2', userId: 'supabase-user-1', role: 'MODERATOR', assignedBy: 'bootstrap-admin', createdAt: new Date().toISOString() }), /E11000/, 'A role can be assigned only once per user.');
    await db.collection('download_logs').insertOne({ id: 'download-epub', userId: 'supabase-user-1', bookId: 'book-1', editionId: 'edition-1', fileId: 'file-epub', format: 'EPUB', downloadedAt: new Date().toISOString(), rightsRecordId: 'rights-1' });
    assert.equal(await db.collection('download_logs').countDocuments({ format: 'EPUB' }), 1, 'P8 current validator must accept EPUB download logs.');
    console.log('P8 MongoDB authorization and EPUB migration gate passed.');
  } finally { await client.close(); await mongo.stop(); }
};
main().catch((error) => { console.error(error); process.exitCode = 1; });
