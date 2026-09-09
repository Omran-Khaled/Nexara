import { randomUUID } from 'node:crypto';
import { FileFormat } from '../../src/types';

export interface BookFileRecord {
  id: string; bookId: string; editionId: string; format: FileFormat; mimeType: string; storageKey: string;
  sizeBytes: number; checksum: string; sourceUrl?: string; storageProvider: string;
  contentInspection?: 'PASSED'; malwareScanStatus?: 'CLEAN' | 'NOT_CONFIGURED'; malwareScanner?: string | null;
  downloadAllowed: boolean; readingAllowed: boolean; offlineAllowed: boolean; createdAt: string; updatedAt: string; verifiedAt?: string;
}
export interface BookFileRepository {
  create(record: BookFileRecord): Promise<BookFileRecord>;
  get(bookId: string, editionId: string, fileId: string): Promise<BookFileRecord | null>;
  list(bookId: string, editionId: string): Promise<BookFileRecord[]>;
  markVerified(fileId: string, checksum: string): Promise<BookFileRecord>;
  delete(fileId: string): Promise<boolean>;
}
export class MemoryBookFileRepository implements BookFileRepository {
  private readonly rows = new Map<string, BookFileRecord>();
  async create(record: BookFileRecord) { this.rows.set(record.id, record); return record; }
  async get(bookId: string, editionId: string, fileId: string) { const row = this.rows.get(fileId); return row && row.bookId === bookId && row.editionId === editionId ? row : null; }
  async list(bookId: string, editionId: string) { return [...this.rows.values()].filter((row) => row.bookId === bookId && row.editionId === editionId).sort((a, b) => a.format.localeCompare(b.format)); }
  async markVerified(fileId: string, checksum: string) { const row = this.rows.get(fileId); if (!row) throw new Error('File not found.'); const next = { ...row, checksum, verifiedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; this.rows.set(fileId, next); return next; }
  async delete(fileId: string) { return this.rows.delete(fileId); }
}
export function newFileId() { return `file-${randomUUID()}`; }
