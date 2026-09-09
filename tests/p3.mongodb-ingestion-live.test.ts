import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { GutenbergDownloadService } from "../server/discovery/GutenbergDownloadService";
import { applyP3IngestionMigration } from "../server/db/migrations";
import { MongoBookRepository } from "../server/repositories/MongoBookRepository";
import { MongoCatalogRepository } from "../server/repositories/CatalogRepository";
import { MongoIngestionRepository } from "../server/repositories/IngestionRepositories";
import {
  MongoAuditLogRepository,
  MongoRightsRepository,
} from "../server/repositories/LibraryRepositories";
import { BookService } from "../server/services/BookService";
import {
  AuditService,
  RightsService,
} from "../server/services/LibraryServices";
import {
  GutenbergIngestionSourceGateway,
  IngestionService,
  MongoIngestionPublisher,
} from "../server/services/IngestionService";
import { BookFileService } from "../server/services/BookFileService";
import { MongoBookFileRepository } from "../server/storage/MongoBookFileRepository";
import { LocalStorageProvider } from "../server/storage/StorageProvider";
import { createGutenbergFixtureFetch } from "./fixtures/gutenbergLiveFixture";

// The full production-shaped wiring (real MongoMemoryReplSet + repositories +
// services + byte-for-byte checksum publish) runs with a deterministic,
// offline-only Gutenberg/Gutendex fixture by default so CI and every machine
// get identical results (the third-party hosts are unreliable from datacenter
// IPs). Set NEXARA_LIVE_INGESTION_NETWORK=1 to run the real network path.
const fetchFn = process.env.NEXARA_LIVE_INGESTION_NETWORK === "1" ? fetch : createGutenbergFixtureFetch();

const memory = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
const client = new MongoClient(memory.getUri());
const storageRoot = join(tmpdir(), "nexara-p3-live-storage");
await client.connect();
const db = client.db("nexara-p3-live-ingestion");
try {
  await applyP3IngestionMigration(db);
  const bookRepository = new MongoBookRepository(db);
  const audit = new AuditService(new MongoAuditLogRepository(db));
  // Full production-shaped wiring: reviewed import -> approval -> durable book,
  // durable file record (MongoDB) + bytes (storage provider), rights record.
  const pipeline = new IngestionService(
    new MongoIngestionRepository(db),
    new GutenbergIngestionSourceGateway(new GutenbergDownloadService(fetchFn), fetchFn),
    new MongoIngestionPublisher(new MongoCatalogRepository(db)),
    new BookService(bookRepository),
    new RightsService(bookRepository, new MongoRightsRepository(db), audit),
    new BookFileService(
      new MongoBookFileRepository(db),
      new LocalStorageProvider(storageRoot),
    ),
  );
  const job = await pipeline.startGutenberg("11", "p3-live-admin");
  assert.equal(job.provider, "Gutenberg");
  assert.equal(job.status, "READY_FOR_REVIEW");
  assert.ok(job.rights?.evidence.includes("copyright=false"));
  assert.ok(job.sourceFile && job.sourceFile.bytes > 400);
  assert.ok((job.extractedChapters || 0) > 0);
  // Canonical reviewed-import contract: nothing is persisted before the
  // administrator's explicit approval.
  assert.equal(
    job.candidateBookId,
    undefined,
    "candidates must not be persisted before explicit approval",
  );
  assert.equal(
    await db.collection("books").countDocuments({}),
    0,
    "no book may exist before approval",
  );
  assert.equal(
    await db.collection("rights_records").countDocuments({}),
    0,
    "no rights record may exist before approval",
  );
  assert.equal(
    await db.collection("book_files").countDocuments({}),
    0,
    "no file record may exist before approval",
  );

  const published = await pipeline.publish(job.id, "p3-live-admin");
  assert.equal(published.status, "PUBLISHED");
  assert.ok(
    published.candidateBookId,
    "approval must bind the job to its persisted book",
  );
  const bookId = published.candidateBookId!;
  assert.equal(
    (await db.collection("books").findOne({ id: bookId }))?.workflowStatus,
    "PUBLISHED",
  );
  // Durable rights evidence bound to the ingested book and exact source digest.
  const rights = await db
    .collection("rights_records")
    .find({ bookId, status: "PUBLIC_DOMAIN" })
    .toArray();
  assert.equal(rights.length, 1);
  assert.equal(rights[0].sourceFileSha256, published.sourceFile?.sha256);
  // Durable file record + stored bytes, proven recoverable by a fresh provider
  // over the same root (restart simulation).
  const fileRecord = await db.collection("book_files").findOne({ bookId });
  assert.ok(fileRecord, "the approved source must have a durable file record");
  assert.equal(fileRecord!.checksum, published.sourceFile?.sha256);
  assert.equal(fileRecord!.sizeBytes, published.sourceFile?.bytes);
  const persistedBook = await new MongoBookRepository(db).findById(bookId);
  const edition = persistedBook?.editions?.[0];
  assert.equal(
    edition?.files?.[0]?.id,
    fileRecord!.id,
    "the edition must reference the stored file through the Mongo read projection",
  );
  const recovered = await new LocalStorageProvider(storageRoot).get(
    fileRecord!.storageKey,
  );
  const chunks: Buffer[] = [];
  for await (const chunk of recovered.stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const recoveredBytes = Buffer.concat(chunks);
  assert.equal(
    createHash("sha256").update(recoveredBytes).digest("hex"),
    published.sourceFile?.sha256,
    "stored bytes must survive a provider restart byte-for-byte",
  );

  assert.equal(
    await db
      .collection("schema_migrations")
      .countDocuments({ id: "p3-ingestion-schema-v1" }),
    1,
  );
  const indexNames = (await db.collection("ingestion_jobs").indexes()).map(
    (index) => index.name,
  );
  assert.ok(indexNames.includes("ingestion_job_id_unique"));
  assert.ok(indexNames.includes("ingestion_status_updated"));
  console.log(
    "P3 live Gutenberg-to-Mongo ingestion and publishing checks passed.",
  );
} finally {
  await client.close();
  await memory.stop();
  await rm(storageRoot, { recursive: true, force: true }).catch(
    () => undefined,
  );
}
