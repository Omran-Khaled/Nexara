import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../server/createApp';
import { InMemoryAuthorizationRepository } from '../server/auth/AuthorizationRepository';
import { applyP2Migrations } from '../server/db/migrations';
import { DiscoveryService } from '../server/discovery/DiscoveryService';
import { DiscoveryProvider } from '../server/discovery/types';
import { MongoBookRepository } from '../server/repositories/MongoBookRepository';
import { MongoCatalogRepository } from '../server/repositories/CatalogRepository';
import { InMemoryBookRepository } from '../server/repositories/BookRepository';
import { InMemoryAuditLogRepository, InMemoryBookmarkRepository, InMemoryCollectionRepository, InMemoryHighlightRepository, InMemoryReadingProgressRepository, InMemoryReviewRepository, InMemoryRightsRepository, MongoAuditLogRepository, MongoBookmarkRepository, MongoCollectionRepository, MongoHighlightRepository, MongoReadingProgressRepository, MongoReviewRepository, MongoRightsRepository } from '../server/repositories/LibraryRepositories';
import { MemoryBookFileRepository } from '../server/storage/BookFileRepository';
import { LocalStorageProvider } from '../server/storage/StorageProvider';
import { INITIAL_AUTHORS } from './fixtures/libraryFixtures';
import { close, p14Book, request, sha256, uploadBookFile } from './p14.shared';

const reader = { id: 'p14-reader', role: 'READER' as const, territory: 'US' };
const admin = { id: 'p14-admin', role: 'ADMIN' as const, territory: 'US' };

function deterministicDiscovery(): DiscoveryService {
  const provider: DiscoveryProvider = {
    name: 'Heritage',
    timeoutMs: 100,
    search: async (query) => [{
      externalId: 'p14-discovery-1',
      title: `P14 Discovery Result for ${query}`,
      author: 'P14 Discovery Author',
      subjects: ['Literature'],
      contentAvailability: 'FULL_TEXT',
      rightsStatus: 'PUBLIC_DOMAIN',
      rightsVerification: 'VERIFIED',
      previewStatus: 'NEXARA_RETRIEVED',
    }],
  };
  return new DiscoveryService([provider]);
}

async function runHttpIntegration(): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'nexara-p14-integration-'));
  const book = p14Book({ id: 'p14-integration-book', slug: 'p14-integration-book' });
  const roles = new InMemoryAuthorizationRepository();
  await roles.assignRole({ userId: admin.id, role: 'ADMIN', assignedBy: 'p14-bootstrap' });
  const app = createApp({
    bookRepository: new InMemoryBookRepository([book]),
    progressRepository: new InMemoryReadingProgressRepository(),
    bookmarkRepository: new InMemoryBookmarkRepository(),
    highlightRepository: new InMemoryHighlightRepository(),
    collectionRepository: new InMemoryCollectionRepository(),
    reviewRepository: new InMemoryReviewRepository(),
    rightsRepository: new InMemoryRightsRepository(),
    auditRepository: new InMemoryAuditLogRepository(),
    fileRepository: new MemoryBookFileRepository(),
    storageProvider: new LocalStorageProvider(root),
    discoveryService: deterministicDiscovery(),
    authorizationRepository: roles,
    auth: { supabaseUrl: null, supabasePublishableKey: null, allowTestIdentity: true, useTestRoleResolver: true, roleResolver: roles },
  });
  const server = app.listen(0);
  try {
    // API + authentication: server role lookup overrides a claimed role and guests are rejected.
    assert.equal((await request(server, 'GET', '/api/health/live', { identity: reader })).status, 200);
    assert.equal((await request(server, 'GET', '/api/auth/me')).status, 401);
    const authenticated = await request(server, 'GET', '/api/auth/me', { identity: reader });
    assert.equal(authenticated.status, 200);
    assert.deepEqual(authenticated.json.data.roles, ['READER']);
    assert.equal((await request(server, 'PATCH', `/api/books/${book.id}`, { body: { title: 'Reader escalation attempt' }, identity: reader })).status, 403);

    // Discovery: an injected provider is normalized and exposed through the real API route.
    const discovery = await request(server, 'GET', '/api/discovery/search?q=heritage&limit=10', { identity: reader });
    assert.equal(discovery.status, 200);
    assert.equal(discovery.json.data[0].providerExternalIds.Heritage, 'p14-discovery-1');
    assert.equal(discovery.json.providers[0].status, 'fulfilled');

    // Downloads: upload actual bytes, authorize them, stream them, and compare SHA-256 end to end.
    const original = Buffer.from('%PDF-1.7\nP14 verified integration book\n%%EOF');
    const uploaded = await uploadBookFile(server, book.id, book.editions[0].id, original);
    assert.equal(uploaded.checksum, sha256(original));
    const availability = await request(server, 'GET', `/api/books/${book.id}/editions/${book.editions[0].id}/downloads`, { identity: reader });
    assert.equal(availability.status, 200);
    assert.equal(availability.json.data.files[0].availability, 'AVAILABLE');
    const issued = await request(server, 'POST', `/api/books/${book.id}/editions/${book.editions[0].id}/files/${uploaded.id}/downloads`, { body: { expiresInSeconds: 60 }, identity: reader });
    assert.equal(issued.status, 201, issued.body.toString('utf8'));
    const delivery = await request(server, 'GET', issued.json.data.href, { identity: reader });
    assert.equal(delivery.status, 200);
    assert.equal(sha256(delivery.body), uploaded.checksum, 'The delivered file must equal the uploaded bytes by SHA-256.');
    assert.match(String(delivery.headers['content-disposition']), /attachment/i);

    // API reading progress: authenticated reader can persist and retrieve a completed chapter position.
    const progress = await request(server, 'PUT', `/api/reading-progress/${book.id}`, {
      body: { editionId: book.editions[0].id, currentChapterIndex: 1, currentScrollPercent: 75, completedPercent: 75, totalSecondsSpent: 180, clientSequence: 1, clientUpdatedAt: '2026-08-18T00:05:00.000Z' },
      identity: reader,
    });
    assert.equal(progress.status, 200);
    assert.equal(progress.json.data.currentChapterIndex, 1);
    const restored = await request(server, 'GET', `/api/reading-progress?userId=${reader.id}`, { identity: reader });
    assert.equal(restored.status, 200);
    assert.equal(restored.json.data[0].completedPercent, 75);
  } finally {
    await close(server);
    await rm(root, { recursive: true, force: true });
  }
}

async function runMongoIntegration(): Promise<void> {
  const memory = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const client = new MongoClient(memory.getUri());
  await client.connect();
  const db = client.db('nexara-p14-master-gate');
  try {
    await applyP2Migrations(db);
    const author = structuredClone(INITIAL_AUTHORS[0]);
    author.id = 'author-p14-mongo';
    author.slug = 'author-p14-mongo';
    const workId = 'work-p14-mongo';
    const catalog = new MongoCatalogRepository(db);
    await catalog.createAuthor(author);
    await catalog.createWork({ id: workId, authorId: author.id, slug: workId, title: 'P14 Mongo Work', titleAr: 'عمل P14 مع MongoDB', description: 'Canonical work for P14 MongoDB integration.', descriptionAr: 'عمل معياري لاختبار تكامل P14 مع MongoDB.', primaryLanguage: 'en', publicationYear: 2026 });
    const book = p14Book({ id: 'p14-mongo-book', workId, authorId: author.id, authorName: author.name, authorNameAr: author.nameAr, slug: 'p14-mongo-book' });
    const books = new MongoBookRepository(db);
    await books.create(book);
    const roles = new InMemoryAuthorizationRepository();
    const app = createApp({
      bookRepository: books,
      progressRepository: new MongoReadingProgressRepository(db),
      bookmarkRepository: new MongoBookmarkRepository(db),
      highlightRepository: new MongoHighlightRepository(db),
      collectionRepository: new MongoCollectionRepository(db),
      reviewRepository: new MongoReviewRepository(db),
      rightsRepository: new MongoRightsRepository(db),
      auditRepository: new MongoAuditLogRepository(db),
      authorizationRepository: roles,
      auth: { supabaseUrl: null, supabasePublishableKey: null, allowTestIdentity: true, useTestRoleResolver: true, roleResolver: roles },
    });
    const liveServer = app.listen(0);
    try {
      const detail = await request(liveServer, 'GET', `/api/books/${book.id}`, { identity: reader });
      assert.equal(detail.status, 200);
      assert.equal(detail.json.data.id, book.id);
      const latest = await request(liveServer, 'PUT', `/api/reading-progress/${book.id}`, { body: { editionId: book.editions[0].id, currentChapterIndex: 0, currentScrollPercent: 66, completedPercent: 66, totalSecondsSpent: 300, clientSequence: 2, clientUpdatedAt: '2026-08-18T00:06:00.000Z' }, identity: reader });
      assert.equal(latest.status, 200);
      const stale = await request(liveServer, 'PUT', `/api/reading-progress/${book.id}`, { body: { editionId: book.editions[0].id, currentChapterIndex: 0, currentScrollPercent: 20, completedPercent: 20, totalSecondsSpent: 20, clientSequence: 1, clientUpdatedAt: '2026-08-18T00:05:00.000Z' }, identity: reader });
      assert.equal(stale.status, 200);
      assert.equal(stale.json.data.clientSequence, 2, 'Mongo upsert must preserve the latest client sequence.');
      const rows = await request(liveServer, 'GET', `/api/reading-progress?userId=${reader.id}`, { identity: reader });
      assert.equal(rows.status, 200);
      assert.equal(rows.json.data.length, 1);
      assert.equal(rows.json.data[0].completedPercent, 66);
    } finally {
      await close(liveServer);
    }
  } finally {
    await client.close();
    await memory.stop();
  }
}

await runHttpIntegration();
await runMongoIntegration();
console.log('P14 integration gate passed: MongoDB, API, authentication, downloads, and discovery.');
