import assert from 'node:assert/strict';
import { InMemoryBookRepository } from '../server/repositories/BookRepository';
import { InMemoryAuditLogRepository, InMemoryReadingHistoryRepository, InMemoryReadingProgressRepository, InMemoryRightsRepository } from '../server/repositories/LibraryRepositories';
import { BookService } from '../server/services/BookService';
import { allowsFullDownload } from '../server/services/DownloadService';
import { AuditService, ReadingService, RightsService } from '../server/services/LibraryServices';
import { validateBookPatch, validateBookWrite } from '../server/validators/bookValidators';
import { validateProgress, validateRights } from '../server/validators/libraryValidators';
import { clampPercent, monotonicProgress, progressFromViewport, readLocalProgress, writeLocalProgress } from '../src/reader/readingPersistence';
import { p14Book } from './p14.shared';

const validBook = p14Book({ id: 'p14-unit-book', slug: 'p14-unit-book' });

function expectValidation(operation: () => unknown, detail: string): void {
  assert.throws(operation, (error: any) => error?.code === 'VALIDATION_ERROR' && JSON.stringify(error.details || {}).includes(detail));
}

// Validators: valid aggregate plus catalogue, progress, and rights boundary failures.
assert.equal(validateBookWrite(validBook).id, validBook.id);
const duplicateEdition = structuredClone(validBook);
duplicateEdition.editions = [structuredClone(validBook.editions[0]), structuredClone(validBook.editions[0])];
expectValidation(() => validateBookWrite(duplicateEdition), 'duplicate edition ids');
expectValidation(() => validateBookPatch({ hiddenGem: 'yes' }), 'hiddenGem');
expectValidation(() => validateProgress({ editionId: validBook.editions[0].id, currentChapterIndex: 0, currentScrollPercent: 71, completedPercent: 70, totalSecondsSpent: 1, clientSequence: 1, clientUpdatedAt: '2026-08-18T00:00:00.000Z' }), 'completedPercent');
expectValidation(() => validateRights({ bookId: validBook.id, editionId: validBook.editions[0].id, status: 'PUBLIC_DOMAIN', licenseType: 'Public Domain', source: 'https://example.test', evidence: 'Verified record', verificationMethod: 'MANUAL_REVIEW', territory: 'WORLDWIDE', attribution: 'P14' }), 'verifiedAt');
assert.equal(validateRights({ bookId: validBook.id, editionId: validBook.editions[0].id, status: 'PUBLIC_DOMAIN', licenseType: 'Public Domain', source: 'https://example.test', evidence: 'Verified record', verificationMethod: 'MANUAL_REVIEW', territory: 'WORLDWIDE', attribution: 'P14', verifiedAt: '2026-08-18T00:00:00.000Z' }).status, 'PUBLIC_DOMAIN');

// Reader calculations: clamping, scroll-to-progress, chapter-aware monotonic merge, and local persistence.
assert.equal(clampPercent(-1.2), 0);
assert.equal(clampPercent(100.6), 100);
assert.equal(progressFromViewport({ scrollTop: 250, scrollHeight: 1000, clientHeight: 500 }), 50);
assert.equal(progressFromViewport({ scrollTop: 0, scrollHeight: 500, clientHeight: 500 }), 100);
const previous = { bookId: validBook.id, editionId: validBook.editions[0].id, chapterIndex: 0, scrollPercent: 80, completedPercent: 65, totalSecondsSpent: 600, lastReadAt: '2026-08-18T00:00:00.000Z', completed: false, clientSequence: 5 };
const staleSameChapter = { ...previous, scrollPercent: 20, completedPercent: 20, totalSecondsSpent: 60, clientSequence: 2 };
const merged = monotonicProgress(previous, staleSameChapter);
assert.equal(merged.scrollPercent, 80);
assert.equal(merged.completedPercent, 65);
assert.equal(merged.totalSecondsSpent, 600);
assert.equal(merged.clientSequence, 5);
const memory = new Map<string, string>();
const storage = { getItem: (key: string) => memory.get(key) || null, setItem: (key: string, value: string) => { memory.set(key, value); } };
writeLocalProgress(storage, previous);
writeLocalProgress(storage, staleSameChapter);
assert.equal(readLocalProgress(storage, validBook.id)?.completedPercent, 65);

// Repositories: direct monotonic upsert and list scope behavior without HTTP/controllers.
const progressRepository = new InMemoryReadingProgressRepository();
const saved = await progressRepository.upsert({ id: 'p14-progress', userId: 'unit-reader', bookId: validBook.id, editionId: validBook.editions[0].id, currentChapterIndex: 0, currentScrollPercent: 60, completedPercent: 60, lastReadAt: '2026-08-18T00:00:00.000Z', totalSecondsSpent: 120, completed: false, clientSequence: 3, clientUpdatedAt: '2026-08-18T00:00:00.000Z' });
const stale = await progressRepository.upsert({ ...saved, currentScrollPercent: 5, completedPercent: 5, totalSecondsSpent: 5, clientSequence: 2, clientUpdatedAt: '2026-08-18T00:01:00.000Z' });
assert.equal(stale.completedPercent, 60);
assert.equal(stale.clientSequence, 3);
assert.equal((await progressRepository.list('unit-reader')).length, 1);
assert.equal((await progressRepository.list('another-reader')).length, 0);

// Services: catalogue update, reader persistence/history, and rights consistency with audit side effects.
const books = new InMemoryBookRepository([validBook]);
const auditRepository = new InMemoryAuditLogRepository();
const audit = new AuditService(auditRepository);
const bookService = new BookService(books);
const updated = await bookService.update(validBook.id, { title: 'P14 Updated Book' });
assert.equal(updated.title, 'P14 Updated Book');
const history = new InMemoryReadingHistoryRepository();
const reading = new ReadingService(books, progressRepository, audit, history);
const progressed = await reading.upsert(validBook.id, { userId: 'unit-reader', editionId: validBook.editions[0].id, currentChapterIndex: 1, currentScrollPercent: 90, completedPercent: 90, totalSecondsSpent: 240, clientSequence: 4, clientUpdatedAt: '2026-08-18T00:02:00.000Z' });
assert.equal(progressed.currentChapterIndex, 1);
assert.equal((await history.list('unit-reader')).at(-1)?.event, 'PROGRESS_SAVED');
const rightsRepository = new InMemoryRightsRepository();
const rights = new RightsService(books, rightsRepository, audit);
const rightsRecord = await rights.create({ bookId: validBook.id, editionId: validBook.editions[0].id, status: 'PUBLIC_DOMAIN', licenseType: 'Public Domain', source: 'https://example.test/rights', evidence: 'P14 legal evidence', verificationMethod: 'MANUAL_REVIEW', territory: 'WORLDWIDE', attribution: 'P14 attribution', verifiedAt: '2026-08-18T00:00:00.000Z' }, 'unit-admin');
assert.equal(rightsRecord.isCurrent, true);
await assert.rejects(() => rights.create({ bookId: validBook.id, editionId: validBook.editions[0].id, status: 'RESTRICTED', licenseType: 'No download', source: 'https://example.test/rights', evidence: 'P14 legal evidence', verificationMethod: 'MANUAL_REVIEW', territory: 'WORLDWIDE', attribution: 'P14 attribution' }, 'unit-admin'), (error: any) => error?.code === 'VALIDATION_ERROR' && JSON.stringify(error.details || {}).includes('status'));
assert.ok((await audit.list('RIGHTS', rightsRecord.id)).length >= 2, 'Rights mutations must retain pending and completion audit entries.');

// Download rules: legal status, licence, and territory must all allow a full file download.
const publicEdition = structuredClone(validBook.editions[0]);
assert.equal(allowsFullDownload(publicEdition, 'US'), true);
assert.equal(allowsFullDownload({ ...publicEdition, territoryRestrictions: ['CA'] }, 'US'), false);
assert.equal(allowsFullDownload({ ...publicEdition, rightsStatus: 'LICENSED', licenseType: 'PREVIEW_ONLY' }, 'US'), false);
assert.equal(allowsFullDownload({ ...publicEdition, rightsStatus: 'RESTRICTED', licenseType: 'Public Domain' }, 'US'), false);

console.log('P14 unit gate passed: validators, services, repositories, rights, download rules, and reader calculations.');
