import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Db } from 'mongodb';
import { MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../server/createApp';
import { applyP15CatalogMigration } from '../server/db/migrations';
import { MongoBookRepository } from '../server/repositories/MongoBookRepository';
import { MongoCatalogRepository } from '../server/repositories/CatalogRepository';
import { MongoAuditLogRepository, MongoBookmarkRepository, MongoCollectionRepository, MongoHighlightRepository, MongoReadingProgressRepository, MongoRightsRepository, MongoReviewRepository } from '../server/repositories/LibraryRepositories';
import { MongoAuthorizationRepository } from '../server/auth/AuthorizationRepository';
import { LocalAuthenticationService } from '../server/auth/LocalAuthenticationService';
import { MongoBookFileRepository } from '../server/storage/MongoBookFileRepository';
import { BookFileService } from '../server/services/BookFileService';
import { LocalAuthController } from '../server/controllers/LocalAuthController';
import { createLocalAuthRoutes } from '../server/routes/localAuthRoutes';
import { UploadSecurityInspector } from '../server/security/FileUploadSecurity';
import { LocalStorageProvider } from '../server/storage/StorageProvider';
import { close, p14Book, request } from './p14.shared';
import { INITIAL_AUTHORS } from './fixtures/libraryFixtures';

const MAX_BYTES = 52_428_800; // mirrors BOOK_STORAGE_MAX_BYTES=52428800
const TEST_READER_PASSWORD = process.env.NEXARA_TEST_READER_PASSWORD || 'reading-in-the-forest';
const TEST_ADMIN_PASSWORD = process.env.NEXARA_TEST_ADMIN_PASSWORD || 'admin-forest-2026';
const TEST_DUPLICATE_PASSWORD = process.env.NEXARA_TEST_DUPLICATE_PASSWORD || 'another-forest-pass';

function buildLocalRuntimeApp(options: { db: Db; storageRoot: string; localAuth: LocalAuthenticationService; roles: MongoAuthorizationRepository }) {
  const { db, storageRoot, localAuth, roles } = options;
  const storage = new LocalStorageProvider(storageRoot);
  const fileService = new BookFileService(
    new MongoBookFileRepository(db),
    storage,
    () => Date.now(),
    new UploadSecurityInspector({ maxBytes: MAX_BYTES, malwareScanner: null, requireMalwareScan: false }),
    MAX_BYTES,
  );
  const app = createApp({
    bookRepository: new MongoBookRepository(db),
    progressRepository: new MongoReadingProgressRepository(db),
    bookmarkRepository: new MongoBookmarkRepository(db),
    highlightRepository: new MongoHighlightRepository(db),
    collectionRepository: new MongoCollectionRepository(db),
    reviewRepository: new MongoReviewRepository(db),
    rightsRepository: new MongoRightsRepository(db),
    auditRepository: new MongoAuditLogRepository(db),
    authorizationRepository: roles,
    fileRepository: new MongoBookFileRepository(db),
    storageProvider: storage,
    fileService,
    auth: {
      supabaseUrl: null,
      supabasePublishableKey: null,
      authProvider: 'local',
      localSessions: localAuth,
      roleResolver: roles,
      allowTestIdentity: false,
    },
    bookUploadMaxBytes: MAX_BYTES,
  });
  // Mirrors createRuntimeApp: local routes are mounted only in local mode.
  app.use('/api', createLocalAuthRoutes(new LocalAuthController(localAuth)));
  return app;
}

const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
const client = new MongoClient(replSet.getUri());
await client.connect();
const databaseName = 'nexara-p17-local-development';
const db = client.db(databaseName);
await applyP15CatalogMigration(db);
const tempRoot = await mkdtemp(join(tmpdir(), 'nexara-p17-'));
const storageRoot = join(tempRoot, 'book-files');

const roles = new MongoAuthorizationRepository(db);
const localAuth = new LocalAuthenticationService(db, 168);
await localAuth.ensureIndexes();

let server: import('node:http').Server | null = null;
try {
  server = buildLocalRuntimeApp({ db, storageRoot, localAuth, roles }).listen(0);

  // --- 1. Local registration, login, and role resolution ---------------------
  const register = await request(server, 'POST', '/api/auth/local/register', {
    body: { email: 'Reader@Example.com', password: TEST_READER_PASSWORD, displayName: 'Local Reader', displayNameAr: 'قارئ محلي' },
  });
  assert.equal(register.status, 201, register.body.toString());
  const readerToken = register.json.data.token as string;
  assert.ok(readerToken.length >= 40, 'session token must be a strong opaque value');
  assert.equal(register.json.data.user.email, 'reader@example.com', 'email must be normalized to lower case');

  const duplicate = await request(server, 'POST', '/api/auth/local/register', { body: { email: 'reader@example.com', password: TEST_DUPLICATE_PASSWORD } });
  assert.equal(duplicate.status, 409, duplicate.body.toString());
  const weak = await request(server, 'POST', '/api/auth/local/register', { body: { email: 'weak@example.com', password: 'short' } });
  assert.equal(weak.status, 400, weak.body.toString());

  const badLogin = await request(server, 'POST', '/api/auth/local/login', { body: { email: 'reader@example.com', password: 'wrong-password-123' } });
  assert.equal(badLogin.status, 401, badLogin.body.toString());
  const login = await request(server, 'POST', '/api/auth/local/login', { body: { email: 'READER@example.com', password: TEST_READER_PASSWORD } });
  assert.equal(login.status, 200, login.body.toString());
  assert.ok(login.json.data.token, 'login must issue a session token');

  const me = await request(server, 'GET', '/api/auth/me', { headers: { authorization: `Bearer ${readerToken}` } });
  assert.equal(me.status, 200, me.body.toString());
  assert.deepEqual(me.json.data.roles, ['READER'], 'fresh local accounts resolve to READER via the shared role store');

  // Development admin bootstrap mirrors createRuntimeApp: an explicit account
  // plus an ADMIN assignment in the same authorization repository. There is no
  // hardcoded admin identity anywhere.
  const adminAccount = await localAuth.register({ email: 'admin@nexara.local', password: TEST_ADMIN_PASSWORD, displayName: 'Nexara Admin' });
  await roles.assignRole({ userId: adminAccount.id, role: 'ADMIN', assignedBy: 'system:local-bootstrap' });
  const adminToken = adminAccount.token;
  const adminMe = await request(server, 'GET', '/api/auth/me', { headers: { authorization: `Bearer ${adminToken}` } });
  assert.deepEqual(adminMe.json.data.roles, ['ADMIN'], 'bootstrap admin resolves ADMIN from the durable role store');

  const profileUpdate = await request(server, 'PATCH', '/api/auth/local/profile', { headers: { authorization: `Bearer ${readerToken}` }, body: { displayName: 'Renamed Reader', displayNameAr: 'قارئ أعيد تسميته' } });
  assert.equal(profileUpdate.status, 200, profileUpdate.body.toString());
  // The wire contract is the application-level identity shape { id, email, name, nameAr }
  // shared with /api/auth/me — never the persistence field names.
  assert.equal(profileUpdate.json.data.user.name, 'Renamed Reader');
  assert.equal(profileUpdate.json.data.user.nameAr, 'قارئ أعيد تسميته');
  const renamedSession = await request(server, 'GET', '/api/auth/local/session', { headers: { authorization: `Bearer ${readerToken}` } });
  assert.equal(renamedSession.status, 200, renamedSession.body.toString());
  assert.equal(renamedSession.json.data.user.name, 'Renamed Reader', 'renames must survive session restore');

  // --- 2. Local admin upload through the staged-body path --------------------
  // Seed the normalized catalog first (author → work → projection), mirroring
  // runMongoIntegration in p14.integration.test.ts.
  const seededAuthor = { ...structuredClone(INITIAL_AUTHORS[0]), id: 'author-p17-local', slug: 'author-p17-local' };
  const workId = 'work-p17-local';
  const catalog = new MongoCatalogRepository(db);
  await catalog.createAuthor(seededAuthor);
  await catalog.createWork({ id: workId, authorId: seededAuthor.id, slug: workId, title: 'P17 Local Work', titleAr: 'عمل بي ١٧ المحلي', description: 'Local development upload acceptance work.', descriptionAr: 'عمل قبول الرفع المحلي للتطوير.', primaryLanguage: 'en', publicationYear: 2026 });
  const book = p14Book({ id: 'p17-local-book', workId, authorId: seededAuthor.id, authorName: seededAuthor.name, authorNameAr: seededAuthor.nameAr, slug: 'p17-local-book' });
  await new MongoBookRepository(db).create(book);
  const editionId = book.editions[0].id;

  // A READER must never reach upload endpoints.
  const forbiddenCreate = await request(server, 'POST', `/api/books/${book.id}/editions/${editionId}/files/direct-upload`, {
    headers: { authorization: `Bearer ${readerToken}` }, body: { format: 'PDF', mimeType: 'application/pdf' },
  });
  assert.equal(forbiddenCreate.status, 403, forbiddenCreate.body.toString());

  const create = await request(server, 'POST', `/api/books/${book.id}/editions/${editionId}/files/direct-upload`, {
    headers: { authorization: `Bearer ${adminToken}` }, body: { format: 'PDF', mimeType: 'application/pdf' },
  });
  assert.equal(create.status, 201, create.body.toString());
  assert.equal(create.json.data.mode, 'server', 'local storage must select the server-staging upload mode');
  assert.equal(create.json.data.maxBytes, MAX_BYTES);

  const forbiddenStage = await request(server, 'POST', `/api/books/${book.id}/editions/${editionId}/files/direct-upload/staged-body`, {
    headers: { authorization: `Bearer ${readerToken}`, 'content-type': 'application/pdf', 'x-file-format': 'PDF' }, body: Buffer.from('%PDF-1.7\nx\n%%EOF'),
  });
  assert.equal(forbiddenStage.status, 403, forbiddenStage.body.toString());

  const validPdf = Buffer.from('%PDF-1.7\nP17 verified local upload\n%%EOF');
  const staged = await request(server, 'POST', `/api/books/${book.id}/editions/${editionId}/files/direct-upload/staged-body`, {
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/pdf', 'x-file-format': 'PDF' }, body: validPdf,
  });
  assert.equal(staged.status, 201, staged.body.toString());
  const stagedKey = staged.json.data.temporaryStorageKey as string;
  assert.ok(/^nexara-staging\//.test(stagedKey), 'staged bytes must live in the same staging namespace as signed uploads');

  // Corrupted content must be rejected by the shared completion validation.
  const badStaged = await request(server, 'POST', `/api/books/${book.id}/editions/${editionId}/files/direct-upload/staged-body`, {
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/pdf', 'x-file-format': 'PDF' }, body: Buffer.from('definitely not a pdf'),
  });
  assert.equal(badStaged.status, 201, badStaged.body.toString());
  const rejected = await request(server, 'POST', `/api/books/${book.id}/editions/${editionId}/files/complete-direct-upload`, {
    headers: { authorization: `Bearer ${adminToken}` },
    body: { format: 'PDF', mimeType: 'application/pdf', temporaryStorageKey: badStaged.json.data.temporaryStorageKey, readingAllowed: true, downloadAllowed: true, offlineAllowed: false, rights: { bookId: book.id, editionId, status: 'PUBLIC_DOMAIN' } },
  });
  assert.equal(rejected.status, 400, rejected.body.toString());

  const completed = await request(server, 'POST', `/api/books/${book.id}/editions/${editionId}/files/complete-direct-upload`, {
    headers: { authorization: `Bearer ${adminToken}` },
    body: { format: 'PDF', mimeType: 'application/pdf', temporaryStorageKey: stagedKey, originalName: 'p17-local.pdf', readingAllowed: true, downloadAllowed: true, offlineAllowed: true, rights: { bookId: book.id, editionId, status: 'PUBLIC_DOMAIN' } },
  });
  assert.equal(completed.status, 201, completed.body.toString());
  const fileRecord = completed.json.data;
  assert.equal(fileRecord.storageProvider, 'local-test');
  assert.ok(fileRecord.rightsRecordId, 'completion must create the durable rights record');
  const storageAfterComplete = new LocalStorageProvider(storageRoot);
  assert.equal(await storageAfterComplete.exists(stagedKey), false, 'staging object must be deleted after completion');

  // --- 3. Reader availability + rights-authorized download (canonical P6 flow) --
  const availability = await request(server, 'GET', `/api/books/${book.id}/editions/${editionId}/downloads`, { headers: { authorization: `Bearer ${readerToken}` } });
  assert.equal(availability.status, 200, availability.body.toString());
  assert.equal(availability.json.data.files[0].availability, 'AVAILABLE', 'the uploaded book must be downloadable by readers immediately');
  const authorize = await request(server, 'POST', `/api/books/${book.id}/editions/${editionId}/files/${fileRecord.id}/downloads`, {
    headers: { authorization: `Bearer ${readerToken}` }, body: { expiresInSeconds: 120 },
  });
  assert.equal(authorize.status, 201, authorize.body.toString());
  const downloadUrl = new URL(authorize.json.data.href, 'http://127.0.0.1');
  const content = await request(server, 'GET', `${downloadUrl.pathname}${downloadUrl.search}`, { headers: { authorization: `Bearer ${readerToken}` } });
  assert.equal(content.status, 200, content.body.toString());
  assert.ok(content.body.equals(validPdf), 'downloaded bytes must match the uploaded file exactly');

  // --- 4. Logout invalidates the session --------------------------------------
  const logout = await request(server, 'POST', '/api/auth/local/logout', { headers: { authorization: `Bearer ${readerToken}` } });
  assert.equal(logout.status, 204, logout.body.toString());
  const afterLogout = await request(server, 'GET', '/api/auth/me', { headers: { authorization: `Bearer ${readerToken}` } });
  assert.equal(afterLogout.status, 401, 'a logged-out token must stop resolving');

  // --- 5. Restart simulation: fresh runtime objects over the same MongoDB + files
  await close(server).catch(() => undefined);
  server = buildLocalRuntimeApp({ db, storageRoot, localAuth: new LocalAuthenticationService(db, 168), roles }).listen(0);
  const restoredSession = await request(server, 'GET', '/api/auth/local/session', { headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(restoredSession.status, 200, restoredSession.body.toString());
  assert.equal(restoredSession.json.data.user.email, 'admin@nexara.local', 'sessions must survive a server restart');
  const restoredAuthorize = await request(server, 'POST', `/api/books/${book.id}/editions/${editionId}/files/${fileRecord.id}/downloads`, {
    headers: { authorization: `Bearer ${adminToken}` }, body: { expiresInSeconds: 120 },
  });
  assert.equal(restoredAuthorize.status, 201, restoredAuthorize.body.toString());
  const restoredUrl = new URL(restoredAuthorize.json.data.href, 'http://127.0.0.1');
  const restoredContent = await request(server, 'GET', `${restoredUrl.pathname}${restoredUrl.search}`, { headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(restoredContent.status, 200);
  assert.ok(restoredContent.body.equals(validPdf), 'uploaded books must remain downloadable after a restart');
  assert.equal(await db.collection('rights_records').countDocuments({ bookId: book.id }), 1, 'rights must remain consistent after restart');
  console.log('P17 local development mode checks passed.');
} finally {
  if (server) await close(server).catch(() => undefined);
  await client.close();
  await replSet.stop();
  await rm(tempRoot, { recursive: true, force: true });
}


