import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { InitialCatalogIngestor, STANDARD_EBOOKS_LAUNCH_MANIFEST } from '../server/catalog/InitialCatalogIngestion';
import { LocalStorageProvider } from '../server/storage/StorageProvider';

const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: 'wiredTiger' },
});
const client = new MongoClient(replSet.getUri(), { serverSelectionTimeoutMS: 10_000 });
const storageRoot = await mkdtemp(join(tmpdir(), 'nexara-p15-live-'));

try {
  await client.connect();
  const manifest = STANDARD_EBOOKS_LAUNCH_MANIFEST[0];
  const ingestor = new InitialCatalogIngestor(
    client.db('nexara-p15-live'),
    new LocalStorageProvider(storageRoot),
  );
  const [result] = await ingestor.run([manifest], { delayMs: 0 });

  assert(result, 'P15 live ingestion returned no result.');
  assert.equal(result.status, 'PUBLISHED', `P15 live ingestion did not publish: ${result.reason || 'unknown reason'}`);
  assert.ok(result.checksum, 'P15 live ingestion did not produce a checksum.');
  assert.ok(result.chapters >= 2, 'P15 live ingestion did not extract enough chapters.');

  console.log(JSON.stringify({
    passed: true,
    provider: manifest.provider,
    externalId: manifest.externalId,
    status: result.status,
    chapters: result.chapters,
    checksum: result.checksum,
  }));
} finally {
  await client.close();
  await replSet.stop();
  await rm(storageRoot, { recursive: true, force: true });
}
