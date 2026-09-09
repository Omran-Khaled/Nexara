import assert from 'node:assert/strict';
import http from 'node:http';
import { INITIAL_BOOKS } from './fixtures/libraryFixtures';
import { createApp } from '../server/createApp';
import { ConflictError, ValidationError } from '../server/errors/ApplicationErrors';
import { IngestionSourceRecord } from '../server/models/ingestion';
import { InMemoryBookRepository } from '../server/repositories/BookRepository';
import { InMemoryIngestionRepository } from '../server/repositories/IngestionRepositories';
import { InMemoryAuditLogRepository, InMemoryBookmarkRepository, InMemoryCollectionRepository, InMemoryHighlightRepository, InMemoryReadingProgressRepository, InMemoryReviewRepository, InMemoryRightsRepository } from '../server/repositories/LibraryRepositories';
import { BookService } from '../server/services/BookService';
import { AuditService, RightsService } from '../server/services/LibraryServices';
import { IngestionPublisher, IngestionService, IngestionSourceGateway } from '../server/services/IngestionService';
import { BookFileService } from '../server/services/BookFileService';
import { MemoryBookFileRepository } from '../server/storage/BookFileRepository';
import { LocalStorageProvider } from '../server/storage/StorageProvider';

const readableText = `${'A verified public-domain text segment. '.repeat(28)}\n\n${'A second verified source segment for deterministic chapter extraction. '.repeat(24)}`;
const now = '2026-08-17T00:00:00.000Z';
function source(rightsStatus: IngestionSourceRecord['rights']['rightsStatus'] = 'PUBLIC_DOMAIN'): IngestionSourceRecord {
  return {
    provider: 'Gutenberg', externalId: '12345', title: 'P3 Verified Source', authors: ['P3 Author'], subjects: ['Literature', 'Archive'], language: 'en', sourceUrl: 'https://www.gutenberg.org/ebooks/12345', coverUrl: 'https://www.gutenberg.org/cache/epub/12345/pg12345.cover.medium.jpg',
    rights: { rightsStatus, licenseType: 'Project Gutenberg public-domain distribution', evidence: 'Gutendex copyright=false and official Gutenberg source record.', verificationMethod: 'PROVIDER_ASSERTION', territory: 'US', source: 'https://www.gutenberg.org/ebooks/12345', attribution: 'Project Gutenberg eBook #12345.', verifiedAt: now, permalink: 'https://www.gutenberg.org/ebooks/12345', rightsEvidenceUrl: 'https://www.gutenberg.org/ebooks/12345' },
    content: { data: Buffer.from(readableText, 'utf8'), mimeType: 'text/plain; charset=utf-8', sourceUrl: 'https://www.gutenberg.org/files/12345/12345-0.txt' },
  };
}
function wikisourceSource(): IngestionSourceRecord {
  return {
    provider: 'Wikisource', externalId: 'P3_work', title: 'P3 Wikisource Work', authors: ['P3 Wiki Author'], subjects: ['Literature'], language: 'en', sourceUrl: 'https://en.wikisource.org/wiki/P3_work',
    rights: { rightsStatus: 'LICENSED', licenseType: 'CC BY-SA 4.0', evidence: 'The canonical source page visibly identifies CC BY-SA.', verificationMethod: 'LICENSE_DOCUMENT', territory: 'GLOBAL', source: 'https://en.wikisource.org/wiki/P3_work', attribution: 'Source text from Wikisource: P3 Wikisource Work, CC BY-SA 4.0.', verifiedAt: now, permalink: 'https://en.wikisource.org/wiki/P3_work?oldid=1', rightsEvidenceUrl: 'https://en.wikisource.org/wiki/P3_work?oldid=1' },
    content: { data: Buffer.from(readableText, 'utf8'), mimeType: 'text/plain; charset=utf-8', sourceUrl: 'https://en.wikisource.org/wiki/P3_work?oldid=1' },
  };
}
function acoSource(): IngestionSourceRecord {
  return {
    provider: 'ArabicCollectionsOnline', externalId: 'columbia_aco001050', title: 'P3 ACO Arabic Work', authors: ['مؤلف اختبار'], subjects: ['الأدب'], language: 'ar', sourceUrl: 'https://aco.dlib.nyu.edu/book/columbia_aco001050/1',
    rights: { rightsStatus: 'PUBLIC_DOMAIN', licenseType: 'ACO public-domain Arabic-language content', evidence: 'ACO public-domain statement and official title page were reviewed.', verificationMethod: 'PROVIDER_ASSERTION', territory: 'GLOBAL', source: 'https://aco.dlib.nyu.edu/book/columbia_aco001050/1', attribution: 'Source scan from Arabic Collections Online.', verifiedAt: now, permalink: 'https://aco.dlib.nyu.edu/book/columbia_aco001050/1', rightsEvidenceUrl: 'https://aco.dlib.nyu.edu/about' },
    content: { data: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF', 'latin1'), mimeType: 'application/pdf', sourceUrl: 'https://aco.dlib.nyu.edu/download/columbia_aco001050.pdf' },
  };
}
function request(server: http.Server, method: string, path: string, body?: unknown) {
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: address.port, path, method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), 'x-nexara-test-user': 'p3-admin', 'x-nexara-test-role': 'ADMIN' } }, (res) => { let raw = ''; res.on('data', (part) => { raw += part; }); res.on('end', () => resolve({ status: res.statusCode || 0, body: raw ? JSON.parse(raw) : undefined })); });
    req.on('error', reject); if (body) req.write(JSON.stringify(body)); req.end();
  });
}

const books = new InMemoryBookRepository();
const rightsRepository = new InMemoryRightsRepository();
const audit = new AuditService(new InMemoryAuditLogRepository());
const bookService = new BookService(books);
const rights = new RightsService(books, rightsRepository, audit);
const jobs = new InMemoryIngestionRepository();
const gateway: IngestionSourceGateway = { acquireGutenberg: async () => source() };
const publisher: IngestionPublisher = { persist: async (candidate) => bookService.create(candidate.book) };
const fileService = new BookFileService(new MemoryBookFileRepository(), new LocalStorageProvider('/tmp/nexara-p3-ingestion-files'));
const pipeline = new IngestionService(jobs, gateway, publisher, bookService, rights, fileService);

const job = await pipeline.startGutenberg('12345', 'p3-admin');
assert.equal(job.status, 'READY_FOR_REVIEW', 'External source data must not be published automatically.');
assert.equal(job.candidateBookId, undefined, 'No book record may exist before explicit administrator approval.');
assert.equal(job.stages.find((entry) => entry.name === 'PERSISTENCE')?.status, 'PENDING', 'Permanent storage must remain pending during review.');
assert.equal(job.stages.find((entry) => entry.name === 'PUBLISHING')?.status, 'PENDING');
for (const stage of ['METADATA_NORMALIZATION', 'RIGHTS_VERIFICATION', 'FILE_VALIDATION', 'TEXT_EXTRACTION', 'CHAPTER_EXTRACTION', 'COVER_NORMALIZATION', 'METADATA_ENRICHMENT']) assert.equal(job.stages.find((entry) => entry.name === stage)?.status, 'PASSED', `${stage} must pass before review.`);
const published = await pipeline.publish(job.id, 'p3-admin');
assert.equal(published.status, 'PUBLISHED');
assert.ok(published.candidateBookId);
assert.ok(published.sourceFile?.fileId, 'Approval must create a durable internal file record.');
assert.ok(published.sourceFile?.storageKey, 'Approval must store the source file in Nexara storage.');
assert.equal((await bookService.get(published.candidateBookId!)).workflowStatus, 'PUBLISHED');
const persistedRights = await rights.listByBook(published.candidateBookId!);
assert.equal(persistedRights.length, 1, 'Approval must create a durable rights record.');
assert.equal(persistedRights[0].sourceProvider, 'Gutenberg');
assert.equal(persistedRights[0].permalink, 'https://www.gutenberg.org/ebooks/12345');
assert.equal(persistedRights[0].sourceFileSha256, published.sourceFile?.sha256);

const approvedSourceGateway: IngestionSourceGateway = { acquireGutenberg: async () => source(), acquireWikisource: async () => wikisourceSource(), acquireAco: async () => acoSource() };
const approvedSources = new IngestionService(new InMemoryIngestionRepository(), approvedSourceGateway, publisher, bookService, rights, fileService);
const wikiJob = await approvedSources.startWikisource('P3_work', 'en', 'p3-admin');
assert.equal(wikiJob.status, 'READY_FOR_REVIEW');
assert.equal(wikiJob.candidateBookId, undefined, 'Wikisource candidates must not be persisted before approval.');
assert.equal((await approvedSources.publish(wikiJob.id, 'p3-admin')).status, 'PUBLISHED', 'A CC BY-SA work with explicit evidence may be approved.');
const acoJob = await approvedSources.startAco('columbia_aco001050', 'p3-admin');
assert.equal(acoJob.stages.find((entry) => entry.name === 'TEXT_EXTRACTION')?.status, 'SKIPPED', 'Scanned ACO PDFs must not claim unsafe text extraction.');
assert.equal(acoJob.stages.find((entry) => entry.name === 'CHAPTER_EXTRACTION')?.status, 'SKIPPED');
const acoPublished = await approvedSources.publish(acoJob.id, 'p3-admin');
assert.equal(acoPublished.status, 'PUBLISHED');
assert.equal(acoPublished.sourceFile?.mimeType, 'application/pdf');
assert.ok(acoPublished.sourceFile?.storageKey, 'Approved ACO PDF must be stored internally.');

const blockedJobs = new InMemoryIngestionRepository();
const invalidGateway: IngestionSourceGateway = { acquireGutenberg: async () => source('UNAVAILABLE') };
const blocked = new IngestionService(blockedJobs, invalidGateway, publisher, bookService, rights);
await assert.rejects(() => blocked.startGutenberg('99999', 'p3-admin'), (error: unknown) => error instanceof ValidationError);
assert.equal((await blockedJobs.list())[0].status, 'FAILED', 'Unverified or unavailable rights must block ingestion before persistence.');

const apiBook = structuredClone(INITIAL_BOOKS[0]);
apiBook.id = 'p3-direct-publish'; apiBook.slug = 'p3-direct-publish'; apiBook.workflowStatus = 'EDITORIAL_REVIEW';
const apiServer = createApp({ bookRepository: new InMemoryBookRepository([apiBook]), progressRepository: new InMemoryReadingProgressRepository(), bookmarkRepository: new InMemoryBookmarkRepository(), highlightRepository: new InMemoryHighlightRepository(), collectionRepository: new InMemoryCollectionRepository(), reviewRepository: new InMemoryReviewRepository(), rightsRepository: new InMemoryRightsRepository(), auditRepository: new InMemoryAuditLogRepository() }).listen(0);
try {
  const response = await request(apiServer, 'PATCH', `/api/books/${apiBook.id}`, { workflowStatus: 'PUBLISHED' });
  assert.equal(response.status, 409, 'Admin CRUD must not publish a book without the ingestion gate.');
  const directCreate = structuredClone(apiBook); directCreate.id = 'p3-direct-create'; directCreate.slug = 'p3-direct-create'; directCreate.workflowStatus = 'PUBLISHED';
  assert.equal((await request(apiServer, 'POST', '/api/books', directCreate)).status, 409, 'Admin CRUD must not create a published book without the ingestion gate.');
} finally { await new Promise<void>((resolve) => apiServer.close(() => resolve())); }

await assert.rejects(() => pipeline.publish('missing-ingestion', 'p3-admin'), (error: unknown) => error instanceof ConflictError || (error as any)?.code === 'NOT_FOUND');
console.log('P3 ingestion pipeline and publication gate checks passed.');
