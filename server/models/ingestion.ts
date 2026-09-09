import { Book, ContentAvailability, RightsStatus } from '../../src/types';

/** Approved source families. Open Library and Internet Archive remain metadata/link-only. */
export type IngestionProvider = 'Gutenberg' | 'Wikisource' | 'ArabicCollectionsOnline' | 'OpenLibrary' | 'InternetArchive' | 'StandardEbooks';
export type IngestionStageName = 'DISCOVERY' | 'METADATA_NORMALIZATION' | 'RIGHTS_VERIFICATION' | 'CONTENT_ACQUISITION' | 'FILE_VALIDATION' | 'TEXT_EXTRACTION' | 'CHAPTER_EXTRACTION' | 'COVER_NORMALIZATION' | 'METADATA_ENRICHMENT' | 'PERSISTENCE' | 'PUBLISHING';
export type IngestionStageStatus = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'SKIPPED';
export type IngestionStatus = 'DISCOVERED' | 'BLOCKED' | 'READY_FOR_REVIEW' | 'PERSISTED' | 'PUBLISHED' | 'FAILED';

export interface RightsEvidence {
  rightsStatus: RightsStatus;
  licenseType: string;
  evidence: string;
  verificationMethod: 'MANUAL_REVIEW' | 'LICENSE_DOCUMENT' | 'PROVIDER_ASSERTION' | 'RIGHTS_DATABASE';
  territory: string;
  source: string;
  attribution: string;
  verifiedAt: string;
  /** Canonical title-page URL retained for attribution and later re-verification. */
  permalink?: string;
  /** URL where the rights/public-domain claim is visible. */
  rightsEvidenceUrl?: string;
}

export interface IngestionStageRecord {
  name: IngestionStageName;
  status: IngestionStageStatus;
  startedAt?: string;
  completedAt?: string;
  message?: string;
  evidence?: Record<string, unknown>;
}

export interface IngestionJob {
  id: string;
  provider: IngestionProvider;
  providerExternalId: string;
  requestedBy: string;
  requestedAt: string;
  status: IngestionStatus;
  stages: IngestionStageRecord[];
  normalizedMetadata?: Record<string, unknown>;
  rights?: RightsEvidence;
  sourceFile?: {
    url: string;
    mimeType: IngestionMimeType;
    bytes: number;
    sha256: string;
    /** Populated only after the administrator approves durable persistence. */
    fileId?: string;
    storageKey?: string;
  };
  extractedText?: {
    characters: number;
    sha256: string;
  };
  extractedChapters?: number;
  coverUrl?: string;
  candidateBookId?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export type IngestionMimeType = 'application/pdf' | 'application/epub+zip' | 'text/plain; charset=utf-8' | 'text/html; charset=utf-8';

export interface IngestionSourceRecord {
  provider: IngestionProvider;
  externalId: string;
  title: string;
  authors: string[];
  subjects: string[];
  language: string;
  publicationYear?: number;
  coverUrl?: string;
  sourceUrl: string;
  rights?: RightsEvidence;
  content?: {
    data: Buffer;
    mimeType: IngestionMimeType;
    sourceUrl: string;
  };
}

export interface PersistableIngestionBook {
  book: Book;
  rights: RightsEvidence;
}
