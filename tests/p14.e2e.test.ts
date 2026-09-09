import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/createApp';
import { InMemoryAuthorizationRepository } from '../server/auth/AuthorizationRepository';
import { InMemoryBookRepository } from '../server/repositories/BookRepository';
import { InMemoryIngestionRepository } from '../server/repositories/IngestionRepositories';
import { InMemoryAuditLogRepository, InMemoryBookmarkRepository, InMemoryCollectionRepository, InMemoryHighlightRepository, InMemoryReadingHistoryRepository, InMemoryReadingProgressRepository, InMemoryReviewRepository, InMemoryRightsRepository } from '../server/repositories/LibraryRepositories';
import { MemoryBookFileRepository } from '../server/storage/BookFileRepository';
import { LocalStorageProvider } from '../server/storage/StorageProvider';
import { BookService } from '../server/services/BookService';
import { BookFileService } from '../server/services/BookFileService';
import { AuditService, RightsService } from '../server/services/LibraryServices';
import { IngestionPublisher, IngestionService, IngestionSourceGateway } from '../server/services/IngestionService';
import { close, p14Book, request, sha256, uploadBookFile, verifiedTextSource } from './p14.shared';

const reader = { id: 'p14-e2e-reader', role: 'READER' as const, territory: 'US' };
const admin = { id: 'p14-e2e-admin', role: 'ADMIN' as const, territory: 'US' };

const root = await mkdtemp(join(tmpdir(), 'nexara-p14-e2e-'));
const initialBook = p14Book({ id: 'p14-e2e-real-book', slug: 'p14-e2e-real-book' });
const books = new InMemoryBookRepository([initialBook]);
const rightsRepository = new InMemoryRightsRepository();
const auditRepository = new InMemoryAuditLogRepository();
const audit = new AuditService(auditRepository);
const bookService = new BookService(books);
const rightsService = new RightsService(books, rightsRepository, audit);
const jobs = new InMemoryIngestionRepository();
const gateway: IngestionSourceGateway = { acquireGutenberg: async (externalId) => verifiedTextSource(externalId) };
const publisher: IngestionPublisher = { persist: async (candidate) => bookService.create(candidate.book) };
const fileRepository = new MemoryBookFileRepository();
const storageProvider = new LocalStorageProvider(root);
const fileService = new BookFileService(fileRepository, storageProvider);
const ingestion = new IngestionService(jobs, gateway, publisher, bookService, rightsService, fileService);
const roles = new InMemoryAuthorizationRepository();
await roles.assignRole({ userId: admin.id, role: 'ADMIN', assignedBy: 'p14-bootstrap' });
const app = createApp({
  bookRepository: books,
  progressRepository: new InMemoryReadingProgressRepository(),
  historyRepository: new InMemoryReadingHistoryRepository(),
  bookmarkRepository: new InMemoryBookmarkRepository(),
  highlightRepository: new InMemoryHighlightRepository(),
  collectionRepository: new InMemoryCollectionRepository(),
  reviewRepository: new InMemoryReviewRepository(),
  rightsRepository,
  auditRepository,
  fileRepository,
  storageProvider,
  fileService,
  ingestionService: ingestion,
  authorizationRepository: roles,
  auth: { supabaseUrl: null, supabasePublishableKey: null, allowTestIdentity: true, useTestRoleResolver: true, roleResolver: roles },
});
const server = app.listen(0);

try {
  // Flow 1 — open service → library → real book → details → reader → chapter change → progress → exit.
  assert.equal((await request(server, 'GET', '/api/health/live', { identity: reader })).status, 200, 'Flow 1: service opens.');
  const library = await request(server, 'GET', '/api/books?workflowStatus=PUBLISHED&limit=20', { identity: reader });
  assert.equal(library.status, 200, 'Flow 1: library loads.');
  assert.ok(library.json.data.some((item: { id: string }) => item.id === initialBook.id), 'Flow 1: a real published book is listed.');
  const details = await request(server, 'GET', `/api/books/${initialBook.id}`, { identity: reader });
  assert.equal(details.status, 200, 'Flow 1: detail view loads.');
  const editionId = details.json.data.editions[0].id as string;
  assert.equal((await request(server, 'POST', `/api/reading-history/${initialBook.id}/open`, { body: { editionId }, identity: reader })).status, 201, 'Flow 1: reader session opens.');
  const firstChapter = await request(server, 'GET', `/api/books/${initialBook.id}/chapters/0`, { identity: reader });
  assert.equal(firstChapter.status, 200, 'Flow 1: reader opens the first chapter.');
  const secondChapter = await request(server, 'GET', `/api/books/${initialBook.id}/chapters/1`, { identity: reader });
  assert.equal(secondChapter.status, 200, 'Flow 1: reader changes chapter.');
  assert.notEqual(firstChapter.json.data.id, secondChapter.json.data.id);
  const exitProgress = await request(server, 'PUT', `/api/reading-progress/${initialBook.id}`, { body: { editionId, currentChapterIndex: 1, currentScrollPercent: 68, completedPercent: 68, totalSecondsSpent: 205, clientSequence: 1, clientUpdatedAt: '2026-08-18T01:00:00.000Z' }, identity: reader });
  assert.equal(exitProgress.status, 200, 'Flow 1: progress saves before reader exit.');
  const flowOneHistory = await request(server, 'GET', `/api/reading-history?limit=10`, { identity: reader });
  assert.equal(flowOneHistory.status, 200);
  assert.ok(flowOneHistory.json.data.some((event: { event: string }) => event.event === 'OPENED'));
  assert.ok(flowOneHistory.json.data.some((event: { event: string }) => event.event === 'PROGRESS_SAVED'));

  // Flow 2 — real book → download → actual file → verify checksum.
  const originalFile = Buffer.from('%PDF-1.7\nP14 Flow 2 original file bytes\n%%EOF');
  const uploaded = await uploadBookFile(server, initialBook.id, editionId, originalFile, 'PDF', admin);
  assert.equal(uploaded.checksum, sha256(originalFile));
  const authorized = await request(server, 'POST', `/api/books/${initialBook.id}/editions/${editionId}/files/${uploaded.id}/downloads`, { body: { expiresInSeconds: 120 }, identity: reader });
  assert.equal(authorized.status, 201, 'Flow 2: legal download is authorized.');
  const downloaded = await request(server, 'GET', authorized.json.data.href, { identity: reader });
  assert.equal(downloaded.status, 200, 'Flow 2: actual file is delivered.');
  assert.equal(sha256(downloaded.body), uploaded.checksum, 'Flow 2: delivered SHA-256 equals the source file SHA-256.');

  // Flow 3 — sign-up/login fixture → save book → progress → logout → login → restore state.
  const newlyAuthenticated = await request(server, 'GET', '/api/auth/me', { identity: reader });
  assert.equal(newlyAuthenticated.status, 200, 'Flow 3: test-session login resolves the durable READER principal.');
  const saved = await request(server, 'POST', '/api/bookmarks', { body: { bookId: initialBook.id, editionId, chapterIndex: 1, progressPercent: 68, title: 'P14 saved book position' }, identity: reader });
  assert.equal(saved.status, 201, 'Flow 3: book is saved in the authenticated library.');
  const flowThreeProgress = await request(server, 'PUT', `/api/reading-progress/${initialBook.id}`, { body: { editionId, currentChapterIndex: 1, currentScrollPercent: 82, completedPercent: 82, totalSecondsSpent: 260, clientSequence: 2, clientUpdatedAt: '2026-08-18T01:05:00.000Z' }, identity: reader });
  assert.equal(flowThreeProgress.status, 200);
  const loggedOut = await request(server, 'GET', '/api/auth/me');
  assert.equal(loggedOut.status, 401, 'Flow 3: removing the session denies authenticated APIs.');
  const loggedInAgain = await request(server, 'GET', '/api/auth/me', { identity: reader });
  assert.equal(loggedInAgain.status, 200, 'Flow 3: login restores the test principal.');
  const restoredSaved = await request(server, 'GET', `/api/bookmarks?bookId=${initialBook.id}`, { identity: reader });
  const restoredProgress = await request(server, 'GET', `/api/reading-progress?bookId=${initialBook.id}`, { identity: reader });
  assert.equal(restoredSaved.status, 200);
  assert.equal(restoredSaved.json.data.length, 1, 'Flow 3: saved book is restored.');
  assert.equal(restoredProgress.status, 200);
  assert.equal(restoredProgress.json.data[0].completedPercent, 82, 'Flow 3: latest reading progress is restored.');

  // Flow 4 — only an administrator may submit approved sources; approval stores and publishes only after review.
  assert.equal((await request(server, 'POST', '/api/ingestions/wikisource', { body: { externalId: 'Public_domain_work', language: 'en' }, identity: reader })).status, 403, 'Flow 4: a reader cannot submit a Wikisource import.');
  assert.equal((await request(server, 'POST', '/api/ingestions/aco', { body: { externalId: 'columbia_aco001050' }, identity: reader })).status, 403, 'Flow 4: a reader cannot submit an ACO import.');
  const createdJob = await request(server, 'POST', '/api/ingestions/gutenberg', { body: { externalId: '14001' }, identity: admin });
  assert.equal(createdJob.status, 201, createdJob.body.toString('utf8'));
  const job = createdJob.json.data;
  assert.equal(job.status, 'READY_FOR_REVIEW');
  assert.equal(job.candidateBookId, undefined, 'Flow 4: no book is saved before approval.');
  assert.equal(job.stages.find((stage: { name: string }) => stage.name === 'RIGHTS_VERIFICATION').status, 'PASSED');
  assert.equal(job.stages.find((stage: { name: string }) => stage.name === 'FILE_VALIDATION').status, 'PASSED');
  assert.equal(job.stages.find((stage: { name: string }) => stage.name === 'PERSISTENCE').status, 'PENDING', 'Flow 4: permanent storage remains pending for manager review.');
  const published = await request(server, 'POST', `/api/ingestions/${job.id}/publish`, { identity: admin });
  assert.equal(published.status, 200, published.body.toString('utf8'));
  assert.equal(published.json.data.status, 'PUBLISHED');
  assert.ok(published.json.data.candidateBookId);
  assert.ok(published.json.data.sourceFile.fileId, 'Flow 4: approval creates the internal file record.');
  const candidateRights = await request(server, 'GET', `/api/books/${published.json.data.candidateBookId}/rights-records`, { identity: admin });
  assert.equal(candidateRights.status, 200);
  assert.equal(candidateRights.json.data[0].status, 'PUBLIC_DOMAIN', 'Flow 4: rights become durable at approval.');
  assert.ok(candidateRights.json.data[0].sourceFileSha256, 'Flow 4: durable rights retain source checksum evidence.');
  const readerLibrary = await request(server, 'GET', '/api/books?workflowStatus=PUBLISHED&limit=50', { identity: reader });
  assert.ok(readerLibrary.json.data.some((item: { id: string }) => item.id === published.json.data.candidateBookId), 'Flow 4: published book is visible in the reader library.');
  const readerCandidate = await request(server, 'GET', `/api/books/${published.json.data.candidateBookId}/chapters/0`, { identity: reader });
  assert.equal(readerCandidate.status, 200, 'Flow 4: reader can open published text.');

  // Flow 5 — unauthorised user requests a protected resource and is denied.
  const denied = await request(server, 'GET', '/api/audit-logs', { identity: reader });
  assert.equal(denied.status, 403, 'Flow 5: a READER cannot access protected audit records.');

  console.log('P14 E2E gate passed: library-reader, verified-download, session-restore, admin-publication, and unauthorised-denial flows.');
} finally {
  await close(server);
  await rm(root, { recursive: true, force: true });
}
