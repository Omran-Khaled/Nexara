import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { InitialCatalogIngestor, STANDARD_EBOOKS_LAUNCH_MANIFEST, StandardEbookManifest } from '../server/catalog/InitialCatalogIngestion';
import { LocalStorageProvider } from '../server/storage/StorageProvider';
import { validEpub } from '../tests/fixtures/validEpub';

// Deterministic offline smoke of the initial-catalog pipeline. The full
// MongoMemoryReplSet -> quality gates -> persist path runs identically in CI
// and locally by injecting the same controlled `fetchFn` seam as the P15
// acceptance test; the real Standard Ebooks network hosts are unreliable from
// datacenter IPs. Set NEXARA_LIVE_INGESTION_NETWORK=1 to hit the real hosts.
const chapterText = (label: string) => `${label}. ${'A readable chapter demonstrates a real, structured text extraction path. '.repeat(8)}`;
const cover = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2_048, 7)]);

function response(body: Buffer | string, type: string): Response {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
  return new Response(bytes, { status: 200, headers: { 'content-type': type, 'content-length': String(bytes.length) } });
}

function sourceFetch(entry: StandardEbookManifest): typeof fetch {
  const epub = validEpub([
    { name: 'META-INF/container.xml', body: Buffer.from('<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>') },
    { name: 'OEBPS/content.opf', body: Buffer.from('<?xml version="1.0"?><package><metadata><meta name="cover" content="cover"/></metadata><manifest><item id="cover" href="cover.jpg" media-type="image/jpeg" properties="cover-image"/><item id="one" href="chapter-1.xhtml" media-type="application/xhtml+xml"/><item id="two" href="chapter-2.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>') },
    { name: 'OEBPS/cover.jpg', body: cover },
    { name: 'OEBPS/chapter-1.xhtml', body: Buffer.from(`<html><head><title>Chapter One</title></head><body><h1>Chapter One</h1><p>${chapterText('One')}</p></body></html>`) },
    { name: 'OEBPS/chapter-2.xhtml', body: Buffer.from(`<html><head><title>Chapter Two</title></head><body><h1>Chapter Two</h1><p>${chapterText('Two')}</p></body></html>`) },
  ]);
  return (async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url === entry.sourcePageUrl) return response(`<html><body>This ebook is thought to be free of copyright restrictions in the United States.<a href="${new URL(entry.epubUrl).pathname}">Compatible epub</a></body></html>`, 'text/html');
    if (url === entry.epubUrl) return response(epub, 'application/epub+zip');
    if (url === entry.coverUrl) return response(cover, 'image/jpeg');
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
}

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
    process.env.NEXARA_LIVE_INGESTION_NETWORK === '1' ? {} : { fetchFn: sourceFetch(manifest) },
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
