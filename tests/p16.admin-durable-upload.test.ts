import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/createApp';
import { InMemoryBookRepository } from '../server/repositories/BookRepository';
import { InMemoryAuditLogRepository, InMemoryBookmarkRepository, InMemoryCollectionRepository, InMemoryHighlightRepository, InMemoryReadingProgressRepository, InMemoryRightsRepository, InMemoryReviewRepository } from '../server/repositories/LibraryRepositories';
import { InMemoryAuthorizationRepository } from '../server/auth/AuthorizationRepository';
import { MemoryBookFileRepository } from '../server/storage/BookFileRepository';
import { LocalStorageProvider, StorageProvider } from '../server/storage/StorageProvider';
import { close, p14Book, request } from './p14.shared';

class SignedLocalStorage implements StorageProvider {
  readonly name = 'signed-local-test';
  constructor(private readonly local: LocalStorageProvider) {}
  put = this.local.put.bind(this.local);
  get = this.local.get.bind(this.local);
  exists = this.local.exists.bind(this.local);
  delete = this.local.delete.bind(this.local);
  signedReadUrl = this.local.signedReadUrl.bind(this.local);
  async signedWriteUrl(storageKey: string) { return `test://signed-write/${storageKey}`; }
}

const main = async () => {
  const root = await mkdtemp(join(tmpdir(), 'nexara-p16-'));
  const book = p14Book({ id: 'p16-durable-upload-book' });
  const roles = new InMemoryAuthorizationRepository();
  const admin = { id: 'p16-admin', role: 'ADMIN' as const };
  await roles.assignRole({ userId: admin.id, role: 'ADMIN', assignedBy: 'bootstrap' });
  const rights = new InMemoryRightsRepository();
  const files = new MemoryBookFileRepository();
  const storage = new SignedLocalStorage(new LocalStorageProvider(root));
  const app = createApp({
    bookRepository: new InMemoryBookRepository([book]),
    progressRepository: new InMemoryReadingProgressRepository(),
    bookmarkRepository: new InMemoryBookmarkRepository(),
    highlightRepository: new InMemoryHighlightRepository(),
    collectionRepository: new InMemoryCollectionRepository(),
    reviewRepository: new InMemoryReviewRepository(),
    rightsRepository: rights,
    auditRepository: new InMemoryAuditLogRepository(),
    authorizationRepository: roles,
    fileRepository: files,
    storageProvider: storage,
    auth: { supabaseUrl: null, supabasePublishableKey: null, allowTestIdentity: true, useTestRoleResolver: true, roleResolver: roles },
  });
  const server = app.listen(0);
  const editionId = book.editions[0].id;
  try {
    const create = await request(server, 'POST', `/api/books/${book.id}/editions/${editionId}/files/direct-upload`, { body: { format: 'PDF', mimeType: 'application/pdf' }, identity: admin });
    assert.equal(create.status, 201, create.body.toString());
    const stagedKey = create.json.data.temporaryStorageKey as string;
    await storage.put({ storageKey: stagedKey, body: Buffer.from('%PDF-1.7\np16 legal file\n%%EOF'), mimeType: 'application/pdf' });
    const completed = await request(server, 'POST', `/api/books/${book.id}/editions/${editionId}/files/complete-direct-upload`, {
      identity: admin,
      body: {
        format: 'PDF', mimeType: 'application/pdf', temporaryStorageKey: stagedKey, originalName: 'p16.pdf',
        sourceUrl: 'https://example.test/p16-source', readingAllowed: true, downloadAllowed: true, offlineAllowed: false,
        rights: { bookId: book.id, editionId, status: 'PUBLIC_DOMAIN', licenseType: 'Public Domain', source: 'P16 test archive', evidence: 'P16 test verifies a public-domain record.', verificationMethod: 'MANUAL_REVIEW', territory: 'Worldwide', attribution: 'P16 test attribution', rightsEvidenceUrl: 'https://example.test/p16-rights' },
      },
    });
    assert.equal(completed.status, 201, completed.body.toString());
    assert.ok(completed.json.data.rightsRecordId);
    const stored = await files.list(book.id, editionId);
    assert.equal(stored.length, 1);
    const records = await rights.listByBook(book.id);
    assert.equal(records.length, 1);
    assert.equal(records[0].sourceFileSha256, stored[0].checksum);
    assert.equal(await storage.exists(stagedKey), false, 'staging object must be deleted after completion');

    const invalidStart = await request(server, 'POST', `/api/books/${book.id}/editions/${editionId}/files/direct-upload`, { body: { format: 'PDF', mimeType: 'application/pdf' }, identity: admin });
    const invalidStagedKey = invalidStart.json.data.temporaryStorageKey as string;
    await storage.put({ storageKey: invalidStagedKey, body: Buffer.from('%PDF-1.7\np16 rejected file\n%%EOF'), mimeType: 'application/pdf' });
    const rejected = await request(server, 'POST', `/api/books/${book.id}/editions/${editionId}/files/complete-direct-upload`, {
      identity: admin,
      body: {
        format: 'PDF', mimeType: 'application/pdf', temporaryStorageKey: invalidStagedKey, readingAllowed: true, downloadAllowed: true, offlineAllowed: false,
        rights: { bookId: book.id, editionId, status: 'LICENSED', licenseType: 'License', source: 'P16 rejected source', evidence: 'This must fail because the edition is public domain.', verificationMethod: 'MANUAL_REVIEW', territory: 'Worldwide', attribution: 'P16 rejected attribution' },
      },
    });
    assert.equal(rejected.status, 400, rejected.body.toString());
    assert.equal((await files.list(book.id, editionId)).length, 1, 'failed rights recording must remove the newly committed file');
    assert.equal(await storage.exists(invalidStagedKey), false, 'failed completion must still delete staging data');
    console.log('P16 durable admin upload and rights rollback gate passed.');
  } finally { await close(server); }
};
void main();
