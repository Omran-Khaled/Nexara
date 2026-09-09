import { BookEdition, FileFormat, RightsStatus } from '../../src/types';
import { AuthorizationError, ExternalProviderError, NotFoundError, ValidationError } from '../errors/ApplicationErrors';
import { AuthPrincipal } from '../middleware/auth';
import { BookRepository } from '../repositories/BookRepository';
import { AuditService } from './LibraryServices';
import { BookFileService } from './BookFileService';
import { BookFileRecord, BookFileRepository } from '../storage/BookFileRepository';
import { StorageProvider } from '../storage/StorageProvider';
import { logEvent } from '../observability/logger';

export type DownloadAvailabilityStatus = 'AVAILABLE' | 'RIGHTS_RESTRICTED' | 'MISSING_FILE' | 'SOURCE_UNAVAILABLE';

export interface DownloadFileAvailability {
  id: string;
  format: FileFormat;
  mimeType: string;
  sizeBytes: number;
  sizeFormatted: string;
  sourceUrl?: string;
  storageProvider: string;
  availability: DownloadAvailabilityStatus;
}

export interface DownloadAvailability {
  bookId: string;
  editionId: string;
  rightsStatus: RightsStatus;
  licenseType: string;
  source: string;
  attribution: string;
  territory: string | null;
  permittedByRights: boolean;
  sourceProviderAvailable: boolean;
  files: DownloadFileAvailability[];
}

export interface AuthorizedDownload {
  href: string;
  expiresAt: string;
  external: boolean;
  file: DownloadFileAvailability;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function normalizeTerritory(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized && /^[A-Z]{2,3}$/.test(normalized) ? normalized : null;
}

function territoryAllows(edition: BookEdition, territory: string | null): boolean {
  const restrictions = (edition.territoryRestrictions || []).map((value) => value.trim().toUpperCase()).filter(Boolean);
  if (restrictions.length === 0 || restrictions.includes('GLOBAL') || restrictions.includes('WORLDWIDE') || restrictions.includes('ALL')) return true;
  return !!territory && restrictions.includes(territory);
}

function licenseAllows(edition: BookEdition): boolean {
  const license = edition.licenseType.trim().toUpperCase();
  if (!license || license === 'UNKNOWN' || license === 'UNVERIFIED') return false;
  return !['NO_DOWNLOAD', 'READ_ONLY', 'PREVIEW', 'PREVIEW_ONLY', 'RESTRICTED'].some((marker) => license.includes(marker));
}

/** Conservative legal policy: administrators cannot bypass an edition's distribution restrictions. */
export function allowsFullDownload(edition: BookEdition, territory: string | null): boolean {
  if (!territoryAllows(edition, territory)) return false;
  if (edition.rightsStatus === 'PUBLIC_DOMAIN') return true;
  if (edition.rightsStatus === 'OPEN_ACCESS' || edition.rightsStatus === 'LICENSED') return licenseAllows(edition);
  return false;
}

export class DownloadService {
  constructor(
    private readonly books: BookRepository,
    private readonly files: BookFileRepository,
    private readonly fileService: BookFileService,
    private readonly storage: StorageProvider,
    private readonly audit: AuditService,
  ) {}

  private async edition(bookId: string, editionId: string): Promise<BookEdition> {
    const book = await this.books.findById(bookId);
    if (!book) throw new NotFoundError('Book', bookId);
    const edition = book.editions.find((value) => value.id === editionId);
    if (!edition) throw new NotFoundError('Book edition', editionId);
    return edition;
  }

  private fileSummary(file: BookFileRecord, availability: DownloadAvailabilityStatus): DownloadFileAvailability {
    return {
      id: file.id,
      format: file.format,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      sizeFormatted: formatBytes(file.sizeBytes),
      sourceUrl: file.sourceUrl,
      storageProvider: file.storageProvider,
      availability,
    };
  }

  private async verifyProviderAvailability(file: BookFileRecord): Promise<boolean> {
    try {
      return await this.storage.exists(file.storageKey);
    } catch (error) {
      throw new ExternalProviderError('The source storage provider is temporarily unavailable.', { provider: file.storageProvider, cause: error instanceof Error ? error.message : 'unknown' });
    }
  }

  /** Checks stored metadata before a delivery URL is minted; the content route rechecks again while streaming. */
  private async verifyFileIntegrity(file: BookFileRecord): Promise<void> {
    try {
      const object = await this.storage.get(file.storageKey);
      if (object.sizeBytes !== file.sizeBytes || object.checksum !== file.checksum) {
        throw new ValidationError({ file: 'stored object failed integrity verification.' });
      }
      object.stream.destroy();
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new ExternalProviderError('The source storage provider could not verify the file.', { provider: file.storageProvider, cause: error instanceof Error ? error.message : 'unknown' });
    }
  }

  async availability(bookId: string, editionId: string, principal: AuthPrincipal): Promise<DownloadAvailability> {
    const edition = await this.edition(bookId, editionId);
    const territory = normalizeTerritory(principal.territory);
    const permittedByRights = allowsFullDownload(edition, territory);
    const records = await this.files.list(bookId, editionId);
    const files: DownloadFileAvailability[] = [];
    let sourceProviderAvailable = true;

    for (const record of records) {
      try {
        const exists = await this.verifyProviderAvailability(record);
        if (!exists) continue;
        await this.verifyFileIntegrity(record);
        files.push(this.fileSummary(record, permittedByRights && record.downloadAllowed ? 'AVAILABLE' : 'RIGHTS_RESTRICTED'));
      } catch (error) {
        if (error instanceof ExternalProviderError) {
          sourceProviderAvailable = false;
          break;
        }
        throw error;
      }
    }

    return {
      bookId,
      editionId,
      rightsStatus: edition.rightsStatus,
      licenseType: edition.licenseType,
      source: edition.source,
      attribution: edition.attribution,
      territory,
      permittedByRights,
      sourceProviderAvailable,
      files,
    };
  }

  private async auditDecision(action: 'DOWNLOAD_AUTHORIZED' | 'DOWNLOAD_DENIED' | 'DOWNLOAD_SOURCE_UNAVAILABLE' | 'DOWNLOAD_FILE_MISSING' | 'DOWNLOAD_FILE_CORRUPTED', fileId: string, principal: AuthPrincipal, status: 'SUCCESS' | 'REJECTED' | 'FAILED', details: string, requestId?: string): Promise<void> {
    try {
      await this.audit.record(action, 'FILE', fileId, principal.id, details, { status, requestId, source: 'download-service' });
    } finally {
      logEvent(status === 'SUCCESS' ? 'info' : status === 'REJECTED' ? 'warn' : 'error', 'download_event', { ...(requestId ? { requestId } : {}), userId: principal.id, route: 'download', provider: this.storage.name, outcome: action, statusCode: status === 'SUCCESS' ? 201 : status === 'REJECTED' ? 403 : 503, fileId });
    }
  }

  async authorizeDownload(input: { bookId: string; editionId: string; fileId: string; principal: AuthPrincipal; expiresInSeconds?: number; requestId?: string }): Promise<AuthorizedDownload> {
    const { bookId, editionId, fileId, principal, requestId } = input;
    let file: BookFileRecord | null = null;
    try {
      file = await this.files.get(bookId, editionId, fileId);
      if (!file) {
        await this.auditDecision('DOWNLOAD_FILE_MISSING', fileId, principal, 'REJECTED', 'Download denied because the requested file metadata is absent.', requestId);
        throw new NotFoundError('Book file', fileId);
      }
      const edition = await this.edition(bookId, editionId);
      const territory = normalizeTerritory(principal.territory);
      if (!file.downloadAllowed || !allowsFullDownload(edition, territory)) {
        await this.auditDecision('DOWNLOAD_DENIED', file.id, principal, 'REJECTED', `Download denied by rights policy for ${edition.rightsStatus} in territory ${territory || 'UNSPECIFIED'}.`, requestId);
        throw new AuthorizationError('This edition is not licensed for full download in your region.');
      }
      if (!await this.verifyProviderAvailability(file)) {
        await this.auditDecision('DOWNLOAD_FILE_MISSING', file.id, principal, 'REJECTED', 'Download denied because the physical source file is missing.', requestId);
        throw new NotFoundError('Book file', file.id);
      }
      try {
        await this.verifyFileIntegrity(file);
      } catch (error) {
        if (error instanceof ValidationError) {
          await this.auditDecision('DOWNLOAD_FILE_CORRUPTED', file.id, principal, 'REJECTED', 'Download denied because the stored file failed integrity verification.', requestId);
        }
        throw error;
      }
      const issued = await this.fileService.createAccessUrl(file, principal, 'download', input.expiresInSeconds ?? 300);
      const summary = this.fileSummary(file, 'AVAILABLE');
      await this.auditDecision('DOWNLOAD_AUTHORIZED', file.id, principal, 'SUCCESS', `Authorized ${file.format} download after rights and integrity-availability checks.`, requestId);
      return { href: issued.href, expiresAt: issued.expiresAt, external: issued.external, file: summary };
    } catch (error) {
      if (error instanceof ExternalProviderError) {
        await this.auditDecision('DOWNLOAD_SOURCE_UNAVAILABLE', file?.id || fileId, principal, 'FAILED', 'Download could not be authorized because the source provider is unavailable.', requestId);
      }
      throw error;
    }
  }
}
