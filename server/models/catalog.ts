import { Author, Book, BookChapter, BookEdition, BookFile, ContentAvailability, WorkflowStatus } from '../../src/types';

export type UserAccountStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';
export type ReadingHistoryEvent = 'OPENED' | 'PROGRESS_SAVED' | 'COMPLETED';

export interface UserDocument {
  id: string;
  email: string;
  displayName?: string;
  /** Legacy profile display field only; authoritative authorization resides in role_assignments. */
  role: 'READER' | 'MODERATOR' | 'ADMIN';
  status: UserAccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AuthorDocument extends Author {
  createdAt: string;
  updatedAt: string;
}

export interface WorkDocument {
  id: string;
  authorId: string;
  slug: string;
  title: string;
  titleAr: string;
  originalTitle?: string;
  description: string;
  descriptionAr: string;
  primaryLanguage: string;
  publicationYear?: number;
  createdAt: string;
  updatedAt: string;
}

export interface EditionDocument extends Omit<BookEdition, 'files'> {
  id: string;
  bookId: string;
  workId: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookFileDocument extends BookFile {
  id: string;
  bookId: string;
  editionId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChapterDocument extends BookChapter {
  id: string;
  bookId: string;
  editionId: string;
  sequence: number;
  createdAt: string;
  updatedAt: string;
}

export interface CanonicalBookDocument extends Book {
  createdAt: string;
  updatedAt: string;
}

export interface ReadingHistoryDocument {
  id: string;
  userId: string;
  bookId: string;
  editionId: string;
  event: ReadingHistoryEvent;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}

export interface DownloadLogDocument {
  id: string;
  userId: string;
  bookId: string;
  editionId: string;
  fileId: string;
  format: 'PDF' | 'EPUB' | 'TXT' | 'HTML';
  downloadedAt: string;
  rightsRecordId: string;
}

export interface DiscoveryCacheDocument {
  id: string;
  provider: string;
  normalizedQuery: string;
  page: number;
  limit: number;
  records: unknown[];
  expiresAt: Date;
  createdAt: string;
}

export interface ProviderRecordDocument {
  id: string;
  provider: string;
  externalId: string;
  payload: Record<string, unknown>;
  fetchedAt: string;
  updatedAt: string;
}

export interface SchemaMigrationDocument {
  id: string;
  checksum: string;
  appliedAt: string;
}

export interface CatalogueState {
  contentAvailability: ContentAvailability;
  workflowStatus: WorkflowStatus;
}
