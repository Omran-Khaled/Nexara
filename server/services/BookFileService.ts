import { randomUUID } from 'node:crypto';
import { FileFormat } from '../../src/types';
import { AuthorizationError, NotFoundError, ValidationError } from '../errors/ApplicationErrors';
import { AuthPrincipal } from '../middleware/auth';
import { UploadSecurityInspector } from '../security/FileUploadSecurity';
import { BookFileRecord, BookFileRepository, newFileId } from '../storage/BookFileRepository';
import { checksumOf, makeStorageKey, StorageProvider } from '../storage/StorageProvider';

interface Grant { fileId: string; principalId: string; action: 'read' | 'download'; expiresAt: number; token: string; }

/** Signed mode targets S3-compatible object storage; server mode stages bytes through the API for local/dev providers. */
export type DirectUploadTarget =
  | { mode: 'signed'; temporaryStorageKey: string; href: string; expiresAt: string; requiredContentType: string }
  | { mode: 'server'; expiresAt: string; maxBytes: number };

function validateSourceUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.length > 2048) throw new ValidationError({ sourceUrl: 'must not exceed 2048 characters.' });
  let url: URL;
  try { url = new URL(value); } catch { throw new ValidationError({ sourceUrl: 'must be a valid HTTPS URL.' }); }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname || /^(?:127\.0\.0\.1|0\.0\.0\.0|localhost)$/i.test(url.hostname)) {
    throw new ValidationError({ sourceUrl: 'must be a public HTTPS URL without credentials.' });
  }
  return url.toString();
}

export class BookFileService {
  private readonly grants = new Map<string, Grant>();

  constructor(
    private readonly files: BookFileRepository,
    private readonly storage: StorageProvider,
    private readonly now = () => Date.now(),
    private readonly inspector = new UploadSecurityInspector(),
    /** Upload policy ceiling shared by every staging path; defaults to the 100MB body-parser cap. */
    private readonly maxUploadBytes = 104_857_600,
  ) {}

  async upload(input: { bookId: string; editionId: string; format: FileFormat; mimeType: string; body: Buffer; originalName?: string; sourceUrl?: string; downloadAllowed: boolean; readingAllowed: boolean; offlineAllowed: boolean }, principal: AuthPrincipal): Promise<BookFileRecord> {
    // Authorization is enforced once by the controller permission gate (FILE_WRITE / RIGHTS_MANAGE);
    // direct callers (ingestion) are intentionally trusted. The permission matrix remains the sole
    // server-side authority (server/auth/AuthorizationRepository.ts); no role re-check is duplicated here.
    if (!input.readingAllowed && input.offlineAllowed) throw new ValidationError({ offlineAllowed: 'cannot be true when readingAllowed is false.' });
    const inspection = await this.inspector.inspect(input);
    const id = newFileId();
    const storageKey = makeStorageKey(input.bookId, input.editionId, id);
    const checksum = checksumOf(input.body);
    const stored = await this.storage.put({ storageKey, body: input.body, mimeType: input.mimeType, expectedChecksum: checksum });
    if (stored.sizeBytes !== input.body.length || stored.checksum !== checksum) {
      await this.storage.delete(storageKey);
      throw new ValidationError({ file: 'storage integrity verification failed.' });
    }
    const timestamp = new Date(this.now()).toISOString();
    const record: BookFileRecord = {
      id,
      bookId: input.bookId,
      editionId: input.editionId,
      format: input.format,
      mimeType: input.mimeType,
      storageKey,
      sizeBytes: stored.sizeBytes,
      checksum: stored.checksum,
      // Optional fields are omitted rather than written as undefined: the MongoDB
      // driver serializes undefined as BSON null, which the versioned book_files
      // $jsonSchema validator (string-typed columns) correctly rejects.
      ...(input.sourceUrl ? { sourceUrl: validateSourceUrl(input.sourceUrl) } : {}),
      storageProvider: this.storage.name,
      downloadAllowed: input.downloadAllowed,
      readingAllowed: input.readingAllowed,
      offlineAllowed: input.offlineAllowed,
      contentInspection: 'PASSED',
      malwareScanStatus: inspection.malwareScanStatus,
      ...(inspection.malwareScanner ? { malwareScanner: inspection.malwareScanner } : {}),
      createdAt: timestamp,
      updatedAt: timestamp,
      verifiedAt: timestamp,
    };
    try { return await this.files.create(record); } catch (error) { await this.storage.delete(storageKey); throw error; }
  }

  async createDirectUploadUrl(input: { bookId: string; editionId: string; format: FileFormat; mimeType: string }, principal: AuthPrincipal): Promise<DirectUploadTarget> {
    if (!input.format || !input.mimeType) throw new ValidationError({ file: 'format and mimeType are required.' });
    const expiresInSeconds = 300;
    if (!this.storage.signedWriteUrl) {
      // Providers without signed-write support (development local storage) cannot
      // accept a browser PUT; the client stages the same bytes through
      // POST .../files/direct-upload/staged-body instead. Validation, rights,
      // and commit semantics are identical for both modes.
      return {
        mode: 'server',
        expiresAt: new Date(this.now() + expiresInSeconds * 1000).toISOString(),
        maxBytes: this.maxUploadBytes,
      };
    }
    const temporaryStorageKey = `nexara-staging/${randomUUID()}.${input.format.toLowerCase()}`;
    return {
      mode: 'signed',
      temporaryStorageKey,
      href: await this.storage.signedWriteUrl(temporaryStorageKey, input.mimeType, expiresInSeconds),
      expiresAt: new Date(this.now() + expiresInSeconds * 1000).toISOString(),
      requiredContentType: input.mimeType,
    };
  }

  /** Server-mediated staging used by the 'server' direct-upload mode (development/local storage). */
  async stageDirectUploadBody(input: { format: FileFormat; mimeType: string; body: Buffer }): Promise<{ temporaryStorageKey: string }> {
    if (!input.format || !input.mimeType) throw new ValidationError({ file: 'format and mimeType are required.' });
    if (!input.body || input.body.length === 0) throw new ValidationError({ file: 'must not be empty.' });
    if (input.body.length > this.maxUploadBytes) throw new ValidationError({ file: `exceeds the ${Math.floor(this.maxUploadBytes / 1_048_576)}MB storage policy.` });
    const temporaryStorageKey = `nexara-staging/${randomUUID()}.${input.format.toLowerCase()}`;
    try {
      await this.storage.put({ storageKey: temporaryStorageKey, body: input.body, mimeType: input.mimeType });
    } catch (error) {
      await this.storage.delete(temporaryStorageKey).catch(() => undefined);
      throw error;
    }
    return { temporaryStorageKey };
  }

  async completeDirectUpload(input: { bookId: string; editionId: string; format: FileFormat; mimeType: string; temporaryStorageKey: string; originalName?: string; sourceUrl?: string; downloadAllowed: boolean; readingAllowed: boolean; offlineAllowed: boolean }, principal: AuthPrincipal): Promise<BookFileRecord> {
    if (!/^nexara-staging\/[A-Za-z0-9-]+\.(?:pdf|epub|txt|html)$/i.test(input.temporaryStorageKey)) {
      throw new ValidationError({ temporaryStorageKey: 'is not a valid Nexara direct-upload key.' });
    }
    const staged = await this.storage.get(input.temporaryStorageKey);
    const chunks: Buffer[] = [];
    for await (const chunk of staged.stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const body = Buffer.concat(chunks);
    try {
      return await this.upload({
        bookId: input.bookId,
        editionId: input.editionId,
        format: input.format,
        mimeType: input.mimeType,
        body,
        originalName: input.originalName,
        sourceUrl: input.sourceUrl,
        downloadAllowed: input.downloadAllowed,
        readingAllowed: input.readingAllowed,
        offlineAllowed: input.offlineAllowed,
      }, principal);
    } finally {
      await this.storage.delete(input.temporaryStorageKey).catch(() => undefined);
    }
  }

  /** Removes an uncommitted durable file after a legal-record failure; it is never exposed once its repository record is removed. */
  async discard(record: BookFileRecord): Promise<void> {
    await this.files.delete(record.id).catch(() => false);
    await this.storage.delete(record.storageKey).catch(() => undefined);
  }

  async metadata(bookId: string, editionId: string, fileId: string) {
    const file = await this.files.get(bookId, editionId, fileId);
    if (!file) throw new NotFoundError('Book file', fileId);
    return file;
  }

  private authorize(file: BookFileRecord, principal: AuthPrincipal, action: 'read' | 'download', expiresInSeconds: number) {
    if (action === 'read' && !file.readingAllowed && principal.role !== 'ADMIN') throw new AuthorizationError();
    if (action === 'download' && !file.downloadAllowed && principal.role !== 'ADMIN') throw new AuthorizationError();
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > 3600) throw new ValidationError({ expiresInSeconds: 'must be between 1 and 3600 seconds.' });
  }

  async createAccessUrl(file: BookFileRecord, principal: AuthPrincipal, action: 'read' | 'download', expiresInSeconds = 300) {
    this.authorize(file, principal, action, expiresInSeconds);
    const expiresAt = new Date(this.now() + expiresInSeconds * 1000).toISOString();
    if (this.storage.name === 's3-compatible') return { href: await this.storage.signedReadUrl(file.storageKey, expiresInSeconds), expiresAt, action, external: true };
    const token = randomUUID();
    this.grants.set(token, { fileId: file.id, principalId: principal.id, action, expiresAt: this.now() + expiresInSeconds * 1000, token });
    return { href: `/api/books/${file.bookId}/editions/${file.editionId}/files/${file.id}/content?token=${token}&mode=${action}`, expiresAt, action, external: false };
  }

  async createGrant(file: BookFileRecord, principal: AuthPrincipal, action: 'read' | 'download', expiresInSeconds = 300) {
    this.authorize(file, principal, action, expiresInSeconds);
    const token = randomUUID();
    this.grants.set(token, { fileId: file.id, principalId: principal.id, action, expiresAt: this.now() + expiresInSeconds * 1000, token });
    return { token, expiresAt: new Date(this.now() + expiresInSeconds * 1000).toISOString() };
  }

  async stream(file: BookFileRecord, token: string, principal: AuthPrincipal, requestedAction: 'read' | 'download') {
    const grant = this.grants.get(token);
    if (!grant || grant.fileId !== file.id || grant.principalId !== principal.id || grant.action !== requestedAction || grant.expiresAt <= this.now()) {
      throw new AuthorizationError('The file URL is expired or invalid.');
    }
    this.grants.delete(token);
    const object = await this.storage.get(file.storageKey);
    if (object.checksum !== file.checksum || object.sizeBytes !== file.sizeBytes) throw new ValidationError({ file: 'stored object failed integrity verification.' });
    return object;
  }
}
