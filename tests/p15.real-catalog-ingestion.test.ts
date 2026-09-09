import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { InitialCatalogIngestor, STANDARD_EBOOKS_LAUNCH_MANIFEST, StandardEbookManifest } from '../server/catalog/InitialCatalogIngestion';
import { LocalStorageProvider } from '../server/storage/StorageProvider';
import { validEpub } from './fixtures/validEpub';

const chapterText = (label: string) => `${label}. ${'A readable chapter demonstrates a real, structured text extraction path. '.repeat(8)}`;
const cover = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2_048, 7)]);
const epub = validEpub([
  { name: 'META-INF/container.xml', body: Buffer.from('<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>') },
  { name: 'OEBPS/content.opf', body: Buffer.from('<?xml version="1.0"?><package><metadata><meta name="cover" content="cover"/></metadata><manifest><item id="cover" href="cover.jpg" media-type="image/jpeg" properties="cover-image"/><item id="one" href="chapter-1.xhtml" media-type="application/xhtml+xml"/><item id="two" href="chapter-2.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>') },
  { name: 'OEBPS/cover.jpg', body: cover },
  { name: 'OEBPS/chapter-1.xhtml', body: Buffer.from(`<html><head><title>Chapter One</title></head><body><h1>Chapter One</h1><p>${chapterText('One')}</p></body></html>`) },
  { name: 'OEBPS/chapter-2.xhtml', body: Buffer.from(`<html><head><title>Chapter Two</title></head><body><h1>Chapter Two</h1><p>${chapterText('Two')}</p></body></html>`) },
]);

function manifest(): StandardEbookManifest { return structuredClone(STANDARD_EBOOKS_LAUNCH_MANIFEST[0]); }
function response(body: Buffer | string, type: string): Response { const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body); return new Response(bytes, { status: 200, headers: { 'content-type': type, 'content-length': String(bytes.length) } }); }
function sourceHtml(entry: StandardEbookManifest, validRights = true) { return `<html><body>${validRights ? 'This ebook is thought to be free of copyright restrictions in the United States.' : 'Rights information unavailable.'}<a href="${new URL(entry.epubUrl).pathname}">Compatible epub</a></body></html>`; }
function sourceFetch(entry: StandardEbookManifest, options: { validRights?: boolean; file?: Buffer; fileStatus?: number } = {}): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url === entry.sourcePageUrl) return response(sourceHtml(entry, options.validRights !== false), 'text/html');
    if (url === entry.epubUrl && options.fileStatus) return new Response('not found', { status: options.fileStatus });
    if (url === entry.epubUrl) return response(options.file || epub, 'application/epub+zip');
    if (url === entry.coverUrl) return response(cover, 'image/jpeg');
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
}

const replset = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
const client = new MongoClient(replset.getUri());
const root = await mkdtemp(join(tmpdir(), 'nexara-p15-'));

try {
  await client.connect();
  const db = client.db('p15_catalog');
  const entry = manifest();
  const ingestor = new InitialCatalogIngestor(db, new LocalStorageProvider(root), { fetchFn: sourceFetch(entry) });
  const first = await ingestor.run([entry], { delayMs: 0 });
  assert.equal(first.length, 1);
  assert.equal(first[0].status, 'PUBLISHED');
  assert.equal(first[0].chapters, 2);
  assert.ok(first[0].checksum);

  const bookId = first[0].id;
  const book = await db.collection('books').findOne({ id: bookId }, { projection: { _id: 0 } });
  const edition = await db.collection('editions').findOne({ bookId }, { projection: { _id: 0 } });
  const chapters = await db.collection('chapters').find({ bookId }).toArray();
  const rights = await db.collection('rights_records').findOne({ bookId, isCurrent: true }, { projection: { _id: 0 } });
  const file = await db.collection('book_files').findOne({ bookId, format: 'EPUB' }, { projection: { _id: 0 } });
  const asset = await db.collection('catalog_assets').findOne({ bookId, kind: 'COVER' }, { projection: { _id: 0 } });
  const job = await db.collection('ingestion_jobs').findOne({ candidateBookId: bookId }, { projection: { _id: 0 } });
  assert.equal(book?.workflowStatus, 'PUBLISHED');
  assert.equal(book?.contentAvailability, 'FULL_TEXT');
  assert.equal(edition?.rightsStatus, 'PUBLIC_DOMAIN');
  assert.equal(chapters.length, 2);
  assert.ok(chapters.every((chapter) => typeof chapter.content === 'string' && chapter.content.length >= 160));
  assert.equal(rights?.territory, 'US');
  assert.equal(rights?.verificationMethod, 'LICENSE_DOCUMENT');
  assert.equal(file?.checksum, first[0].checksum);
  assert.equal(file?.contentInspection, 'PASSED');
  assert.ok(file?.verifiedAt);
  assert.ok(asset?.checksum);
  assert.equal(job?.provider, 'StandardEbooks');
  assert.equal(job?.status, 'PUBLISHED');

  const rerun = await ingestor.run([entry], { delayMs: 0 });
  assert.equal(rerun[0].status, 'SKIPPED', 'A successful initial catalog row is idempotent on rerun.');
  assert.equal(await db.collection('book_files').countDocuments({ bookId }), 1, 'Rerun does not duplicate the EPUB record.');

  const missingMetadata = { ...manifest(), externalId: 'rejected-missing-metadata', slug: 'rejected-missing-metadata', title: '' };
  const metadataReject = await new InitialCatalogIngestor(db, new LocalStorageProvider(root), { fetchFn: sourceFetch(missingMetadata) }).run([missingMetadata], { delayMs: 0 });
  assert.equal(metadataReject[0].status, 'REJECTED');
  assert.equal(await db.collection('books').countDocuments({ id: `book-standard-ebooks-${missingMetadata.externalId}` }), 0, 'Incomplete metadata cannot publish a book.');
  assert.equal((await db.collection('ingestion_jobs').findOne({ providerExternalId: missingMetadata.externalId }))?.status, 'BLOCKED');

  const untrustedSource = { ...manifest(), externalId: 'rejected-untrusted-source', slug: 'rejected-untrusted-source', sourcePageUrl: 'https://untrusted.example/book' };
  const sourceReject = await new InitialCatalogIngestor(db, new LocalStorageProvider(root), { fetchFn: sourceFetch(untrustedSource) }).run([untrustedSource], { delayMs: 0 });
  assert.equal(sourceReject[0].status, 'REJECTED');
  assert.equal(await db.collection('books').countDocuments({ id: `book-standard-ebooks-${untrustedSource.externalId}` }), 0, 'An untrusted source cannot publish a book.');
  assert.equal((await db.collection('ingestion_jobs').findOne({ providerExternalId: untrustedSource.externalId }))?.status, 'BLOCKED');

  const missingFile = { ...manifest(), externalId: 'rejected-missing-file', slug: 'rejected-missing-file' };
  const fileMissingReject = await new InitialCatalogIngestor(db, new LocalStorageProvider(root), { fetchFn: sourceFetch(missingFile, { fileStatus: 404 }) }).run([missingFile], { delayMs: 0 });
  assert.equal(fileMissingReject[0].status, 'REJECTED');
  assert.equal(await db.collection('books').countDocuments({ id: `book-standard-ebooks-${missingFile.externalId}` }), 0, 'A missing file cannot publish a book.');
  assert.notEqual((await db.collection('ingestion_jobs').findOne({ providerExternalId: missingFile.externalId }))?.status, 'PUBLISHED');

  const unreadableEpub = validEpub([
    { name: 'META-INF/container.xml', body: Buffer.from('<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>') },
    { name: 'OEBPS/content.opf', body: Buffer.from('<?xml version="1.0"?><package><metadata><meta name="cover" content="cover"/></metadata><manifest><item id="cover" href="cover.jpg" media-type="image/jpeg" properties="cover-image"/><item id="one" href="chapter-1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="one"/></spine></package>') },
    { name: 'OEBPS/cover.jpg', body: cover },
    { name: 'OEBPS/chapter-1.xhtml', body: Buffer.from('<html><body><h1>Only short chapter</h1><p>Too short.</p></body></html>') },
  ]);
  const unreadableChapters = { ...manifest(), externalId: 'rejected-unreadable-chapters', slug: 'rejected-unreadable-chapters' };
  const chaptersReject = await new InitialCatalogIngestor(db, new LocalStorageProvider(root), { fetchFn: sourceFetch(unreadableChapters, { file: unreadableEpub }) }).run([unreadableChapters], { delayMs: 0 });
  assert.equal(chaptersReject[0].status, 'REJECTED');
  assert.equal(await db.collection('books').countDocuments({ id: `book-standard-ebooks-${unreadableChapters.externalId}` }), 0, 'Unreadable chapters cannot publish a book.');
  assert.equal((await db.collection('ingestion_jobs').findOne({ providerExternalId: unreadableChapters.externalId }))?.status, 'BLOCKED');

  const missingRights = { ...manifest(), externalId: 'rejected-missing-rights', slug: 'rejected-missing-rights' };
  const missingRightsIngestor = new InitialCatalogIngestor(db, new LocalStorageProvider(root), { fetchFn: sourceFetch(missingRights, { validRights: false }) });
  const rightsReject = await missingRightsIngestor.run([missingRights], { delayMs: 0 });
  assert.equal(rightsReject[0].status, 'REJECTED');
  assert.equal(await db.collection('books').countDocuments({ id: `book-standard-ebooks-${missingRights.externalId}` }), 0, 'Rights failure cannot publish a book.');
  assert.equal((await db.collection('ingestion_jobs').findOne({ providerExternalId: missingRights.externalId }))?.status, 'BLOCKED');

  const corruptFile = { ...manifest(), externalId: 'rejected-corrupt-epub', slug: 'rejected-corrupt-epub' };
  const corruptIngestor = new InitialCatalogIngestor(db, new LocalStorageProvider(root), { fetchFn: sourceFetch(corruptFile, { file: Buffer.from('not-a-valid-epub') }) });
  const fileReject = await corruptIngestor.run([corruptFile], { delayMs: 0 });
  assert.equal(fileReject[0].status, 'REJECTED');
  assert.equal(await db.collection('books').countDocuments({ id: `book-standard-ebooks-${corruptFile.externalId}` }), 0, 'Corrupt file cannot publish a book.');
  assert.equal((await db.collection('ingestion_jobs').findOne({ providerExternalId: corruptFile.externalId }))?.status, 'BLOCKED');

  console.log('P15 real catalog gate passed: verified source, rights, EPUB checksum, readable chapters, cover asset, durable records, and rejection rules.');
} finally {
  await client.close();
  await replset.stop();
  await rm(root, { recursive: true, force: true });
}
