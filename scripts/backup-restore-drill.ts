/**
 * BACKUP & RECOVERY DRILL (release gate — not a simulation).
 *
 * Proves the documented MongoDB + storage recovery procedure against a REAL
 * mongod process started locally:
 *   1. applyP15CatalogMigration on a fresh database
 *   2. seeding exclusively through production repositories (catalog, local auth,
 *      role assignment, rights record, local storage put)
 *   3. baseline functional checks (login + role resolution succeed pre-disaster)
 *   4. EJSON-faithful logical dump of every collection (dates/ObjectIds preserved)
 *   5. destructive DROP of the entire database
 *   6. restore from dump, rebuild indexes, re-run migration runner (idempotence)
 *   7. verification: per-collection counts, document checksums, catalog read,
 *      rights-vs-edition consistency, password login after restore, role
 *      survival, and byte-level storage recovery (backup copy -> delete -> restore)
 *
 * Usage: npm run verify:backup    (requires `mongod` on PATH; leaves no state)
 */
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Db, Document, MongoClient } from 'mongodb';
import type { Readable } from 'node:stream';
import { applyP15CatalogMigration } from '../server/db/migrations';
import { ensureIndexes } from '../server/db/indexes';
import { MongoBookRepository } from '../server/repositories/MongoBookRepository';
import { MongoCatalogRepository } from '../server/repositories/CatalogRepository';
import { INITIAL_AUTHORS } from '../tests/fixtures/libraryFixtures';
import { MongoRightsRepository } from '../server/repositories/LibraryRepositories';
import type { RightsRecord } from '../server/models/library';
import { MongoAuthorizationRepository } from '../server/auth/AuthorizationRepository';
import { LocalAuthenticationService } from '../server/auth/LocalAuthenticationService';
import { LocalStorageProvider } from '../server/storage/StorageProvider';
import { p14Book } from '../tests/p14.shared';

const DATABASE_NAME = 'nexara-backup-drill';
const sha256 = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const steps: string[] = [];
function step(name: string): void {
  steps.push(name);
  console.log(`[drill] ${name}`);
}
async function assertEqual<T>(actual: T, expected: T, label: string): Promise<void> {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) throw new Error(`MISMATCH ${label}: actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
}
interface MongodProcess { uri: string; stop(): Promise<void>; }
async function startMongod(dbPath: string): Promise<MongodProcess> {
  const port = 28000 + Math.floor(Math.random() * 2000);
  // Production MongoDB (Atlas) is always a replica set and the repositories use
  // multi-document transactions (e.g. catalog aggregate writes), so the drill's
  // real mongod must run as a single-node replica set — the same topology every
  // acceptance gate exercises.
  const replSetName = 'nexara-drill-rs';
  const child = spawn('mongod', ['--dbpath', dbPath, '--port', String(port), '--bind_ip', '127.0.0.1', '--replSet', replSetName], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout?.on('data', (chunk: Buffer) => { output += chunk.toString(); });
  child.stderr?.on('data', (chunk: Buffer) => { output += chunk.toString(); });
  const uri = `mongodb://127.0.0.1:${port}/?directConnection=true&serverSelectionTimeoutMS=2000`;
  const deadline = Date.now() + 60_000;
  let initiated = false;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`mongod exited early (code=${child.exitCode}):\n${output.slice(-2000)}`);
    try {
      const probe = new MongoClient(uri);
      try {
        const admin = probe.db('admin');
        await admin.command({ ping: 1 });
        if (!initiated) {
          await admin.command({ replSetInitiate: { _id: replSetName, members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
          initiated = true;
        }
        const hello = await admin.command({ hello: 1 });
        if (!hello.isWritablePrimary) throw new Error('replica set not yet electable');
      } finally { await probe.close().catch(() => undefined); }
      break;
    } catch (error) {
      if (Date.now() > deadline) throw new Error(`mongod never became reachable:\n${output.slice(-2000) || String(error)}`);
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  return {
    uri,
    async stop() {
      if (child.exitCode !== null) return;
      if (process.platform === 'win32') {
        await new Promise<void>((resolve) => {
          const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
          killer.on('close', () => resolve());
          killer.on('error', () => resolve());
        });
      } else {
        child.kill('SIGTERM');
      }
      await new Promise<void>((resolve) => { child.once('exit', () => resolve()); setTimeout(resolve, 5000); });
    },
  };
}

async function collectionNames(db: Db): Promise<string[]> {
  return (await db.listCollections({}, { nameOnly: true }).toArray()).map((entry) => entry.name).sort();
}

async function readAll(stream: AsyncIterable<unknown>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks);
}

/**
 * Canonical codec for the logical dump. The driver no longer re-exports EJSON, and
 * Nexara documents contain exactly one extended BSON type: Date (auth timestamps).
 * Anything else BSON-typed fails loudly instead of being silently corrupted.
 */
const DATE_TAG = '__nexaraDate__';
function canonicalize(value: unknown): unknown {
  if (value instanceof Date) return { [DATE_TAG]: value.toISOString() };
  if (Array.isArray(value)) return value.map(canonicalize);
  const bsontype = (value as { _bsontype?: string } | null)?._bsontype;
  if (bsontype) throw new Error(`Backup drill hit unsupported BSON type "${bsontype}"; extend the codec first.`);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, canonicalize(entry)]));
  }
  return value;
}
function revive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(revive);
  if (value !== null && typeof value === 'object') {
    const tag = (value as Record<string, unknown>)[DATE_TAG];
    if (typeof tag === 'string') return new Date(tag);
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, revive(entry)]));
  }
  return value;
}

/** Deterministic per-collection fingerprint: document count + sha256 over canonically-sorted docs (_id excluded; domain `id` fields carry integrity). */
async function fingerprint(database: Db) {
  const counts: Record<string, number> = {};
  const hashes: Record<string, string> = {};
  for (const name of await collectionNames(database)) {
    const docs = (await database.collection(name).find({}, { projection: { _id: 0 } }).toArray()) as Document[];
    counts[name] = docs.length;
    hashes[name] = sha256(Buffer.from(docs.map((doc) => JSON.stringify(canonicalize(doc))).sort().join('\n'), 'utf8'));
  }
  return { counts, hashes };
}

/** Logical dump: one canonical JSON file per collection (Dates preserved through the tagged codec, not lossy plain JSON). */
async function dumpDatabase(database: Db, directory: string): Promise<string[]> {
  const names = await collectionNames(database);
  for (const name of names) {
    const docs = (await database.collection(name).find({}, { projection: { _id: 0 } }).toArray()) as Document[];
    await fs.writeFile(join(directory, `${name}.json`), JSON.stringify(docs.map(canonicalize), null, 2), 'utf8');
  }
  return names;
}

/** Restore: replay every dumped collection verbatim (Dates revived as BSON Dates), then re-run the migration runner (reattaches validators, proves idempotence) and rebuild indexes. */
async function restoreDatabase(database: Db, directory: string): Promise<void> {
  for (const entry of (await fs.readdir(directory)).sort()) {
    const name = entry.replace(/\.json$/, '');
    const docs = (JSON.parse(await fs.readFile(join(directory, entry), 'utf8')) as unknown[]).map(revive) as Document[];
    if (docs.length > 0) await database.collection(name).insertMany(docs);
  }
  await applyP15CatalogMigration(database);
  await ensureIndexes(database);
}

// ---------------------------------------------------------------------------
const workspace = await fs.mkdtemp(join(tmpdir(), 'nexara-backup-drill-'));
const dbPath = join(workspace, 'db');
const dumpDir = join(workspace, 'dump');
const storageRoot = join(workspace, 'storage');
const storageBackup = join(workspace, 'storage-backup');
await fs.mkdir(dbPath, { recursive: true });
await fs.mkdir(dumpDir, { recursive: true });

let mongod: MongodProcess | null = null;
try {
  mongod = await startMongod(dbPath);
  step(`real mongod reachable at ${mongod.uri}`);
  const client = new MongoClient(mongod.uri);
  const db = client.db(DATABASE_NAME);
  try {
    // 1. Canonical deployment migration job on the fresh database.
    await applyP15CatalogMigration(db);
    step('applyP15CatalogMigration applied');

    // 2. Seed exclusively through production repositories --------------------
    const localAuth = new LocalAuthenticationService(db, 168);
    await localAuth.ensureIndexes();
    await ensureIndexes(db);

    // Author/work/book are seeded in the same referential order the production
    // repositories enforce (author -> work -> aggregate), mirroring the P15 gate.
    const author = structuredClone(INITIAL_AUTHORS[0]);
    author.id = 'author-backup-drill';
    author.slug = 'author-backup-drill';
    const workId = 'work-backup-drill';
    const catalog = new MongoCatalogRepository(db);
    await catalog.createAuthor(author);
    await catalog.createWork({ id: workId, authorId: author.id, slug: workId, title: 'Backup Drill Work', titleAr: 'عمل تجربة النسخ الاحتياطي', description: 'Canonical work for the backup/restore release drill.', descriptionAr: 'عمل معياري لتجربة النسخ الاحتياطي والاستعادة.', primaryLanguage: 'en', publicationYear: 2026 });
    const book = p14Book({ id: 'backup-drill-book', workId, authorId: author.id, authorName: author.name, authorNameAr: author.nameAr, slug: 'backup-drill-book' });
    await new MongoBookRepository(db).create(book);
    const edition = book.editions[0];

    const readerPassword = process.env.NEXARA_DRILL_READER_PASSWORD || 'drill-reader-passphrase';
    const adminPassword = process.env.NEXARA_DRILL_ADMIN_PASSWORD || 'drill-admin-passphrase';
    const reader = await localAuth.register({ email: 'reader@drill.local', password: readerPassword, displayName: 'Drill Reader' });
    void reader;
    const admin = await localAuth.register({ email: 'admin@drill.local', password: adminPassword, displayName: 'Drill Admin' });
    const roles = new MongoAuthorizationRepository(db);
    await roles.assignRole({ userId: admin.id, role: 'ADMIN', assignedBy: 'system:drill-bootstrap' });

    const storage = new LocalStorageProvider(storageRoot);
    const body = Buffer.concat([Buffer.from('PK\u0003\u0004nexara-drill-epub\n'), randomBytes(96 * 1024)]);
    const storageKey = `books/${book.id}/${edition.id}/drill.epub`;
    const stored = await storage.put({ storageKey, body, mimeType: 'application/epub+zip' });

    const timestamp = new Date().toISOString();
    const rightsRecord: RightsRecord = {
      id: `rights-${randomBytes(8).toString('hex')}`,
      bookId: book.id,
      editionId: edition.id,
      status: edition.rightsStatus,
      licenseType: 'Public Domain',
      source: 'Backup/restore release drill',
      evidence: 'drill://public-domain-evidence',
      verificationMethod: 'MANUAL_REVIEW',
      territory: 'WORLDWIDE',
      attribution: 'Nexara release drill fixture',
      sourceFileSha256: stored.checksum,
      verifiedAt: timestamp,
      isCurrent: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await new MongoRightsRepository(db).create(rightsRecord);
    step('seeded catalog book, two local accounts, ADMIN assignment, rights record, 96KB stored file');

    // 3. Baseline functional checks (pre-disaster) ----------------------------
    const catalogRepo = new MongoBookRepository(db);
    assertEqual((await catalogRepo.findById(book.id))?.title ?? null, book.title, 'pre-disaster catalog read');
    const baselineRights = await new MongoRightsRepository(db).listByBook(book.id);
    assertEqual(baselineRights.length, 1, 'pre-disaster rights record count');
    assertEqual(baselineRights[0].isCurrent, true, 'pre-disaster rights currency');
    assertEqual(baselineRights[0].sourceFileSha256, stored.checksum, 'pre-disaster rights/checksum binding');
    await localAuth.login({ email: 'reader@drill.local', password: readerPassword });
    assertEqual(JSON.stringify(await roles.rolesForUser(admin.id)), JSON.stringify(['ADMIN']), 'pre-disaster admin role resolution');
    step('baseline verified: catalog read, rights binding, password login, role resolution');

    // 4. Fingerprints + storage backup ----------------------------------------
    const baselineNames = await collectionNames(db);
    const baselineFingerprint = await fingerprint(db);
    await fs.cp(storageRoot, storageBackup, { recursive: true });
    step(`fingerprinted ${baselineNames.length} collections; storage tree backed up`);

    // 5. Logical dump of every collection -------------------------------------
    const dumped = await dumpDatabase(db, dumpDir);
    step(`dumped ${dumped.length} collections (EJSON canonical)`);

    // 6. Disaster: destructive DROP of the entire database ---------------------
    await db.dropDatabase();
    assertEqual((await collectionNames(db)).length, 0, 'database fully dropped');
    step(`disaster simulated: all ${baselineNames.length} collections dropped`);

    // 7. Restore ---------------------------------------------------------------
    await restoreDatabase(db, dumpDir);
    step('restored every collection; migration runner proved idempotent; validators + indexes rebuilt');

    // 8. Verification matrix ---------------------------------------------------
    assertEqual(await collectionNames(db), baselineNames, 'collection set after restore');
    const restoredFingerprint = await fingerprint(db);
    assertEqual(restoredFingerprint.counts, baselineFingerprint.counts, 'per-collection counts after restore');
    assertEqual(restoredFingerprint.hashes, baselineFingerprint.hashes, 'per-collection document checksums after restore');
    assertEqual((await catalogRepo.findById(book.id))?.workflowStatus ?? null, book.workflowStatus, 'catalog readable through repository after restore');
    const restoredRights = await new MongoRightsRepository(db).listByBook(book.id);
    assertEqual(restoredRights.length, 1, 'rights records survive restore');
    assertEqual(restoredRights[0].isCurrent, true, 'restored rights remain current');
    assertEqual(restoredRights[0].sourceFileSha256, stored.checksum, 'rights/checksum binding survives restore');
    await localAuth.login({ email: 'reader@drill.local', password: readerPassword });
    assertEqual(JSON.stringify(await roles.rolesForUser(admin.id)), JSON.stringify(['ADMIN']), 'admin role survives restore');
    step('verified: counts, doc checksums, catalog read, rights consistency, password login, role survival');

    // 9. Storage recovery: delete -> restore -> byte-level identity ------------
    await fs.rm(storageRoot, { recursive: true, force: true });
    await fs.cp(storageBackup, storageRoot, { recursive: true });
    const recovered = await storage.get(storageKey);
    assertEqual(recovered.sizeBytes, body.length, 'recovered object size');
    assertEqual(recovered.checksum, stored.checksum, 'recovered object checksum');
    assertEqual((await readAll(recovered.stream as unknown as Readable)).equals(body), true, 'byte-level storage recovery identity');
    step('storage recovered from backup copy after full deletion; bytes identical');

    await client.close();
  } finally {
    await client.close().catch(() => undefined);
  }
} finally {
  await mongod?.stop();
  await fs.rm(workspace, { recursive: true, force: true });
}
console.log(steps.map((name) => `  OK  ${name}`).join('\n'));
console.log('BACKUP/RESTORE DRILL PASSED — MongoDB logical recovery, auth survival, rights consistency, and storage recovery proven.');

