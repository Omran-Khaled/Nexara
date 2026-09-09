import { AuditLog, Bookmark, Highlight, ReadingHistoryEntry, ReadingProgress, Review, ReviewComment, UserCollection } from '../../src/types';

export interface ReadingProgressRecord extends ReadingProgress {
  id: string;
  userId: string;
  /** Monotonic client sequence used to reject stale late-arriving progress writes. */
  clientSequence: number;
  clientUpdatedAt: string;
}

export interface ReadingHistoryRecord extends ReadingHistoryEntry {}

export interface BookmarkRecord extends Bookmark {
  userId: string;
}

export interface HighlightRecord extends Highlight {
  userId: string;
}

export interface CollectionRecord extends UserCollection {
  userId: string;
}

export interface ReviewRecord extends Review {}

export interface ReviewLikeRecord {
  id: string;
  reviewId: string;
  userId: string;
  createdAt: string;
}

export interface ReviewCommentRecord extends ReviewComment {}

export interface RightsRecord {
  id: string;
  bookId: string;
  editionId?: string;
  status: 'PUBLIC_DOMAIN' | 'LICENSED' | 'OPEN_ACCESS' | 'PREVIEW_ONLY' | 'RESTRICTED' | 'UNAVAILABLE';
  licenseType: string;
  source: string;
  evidence: string;
  verificationMethod: 'MANUAL_REVIEW' | 'LICENSE_DOCUMENT' | 'PROVIDER_ASSERTION' | 'RIGHTS_DATABASE' | 'UNVERIFIED_LEGACY';
  territory: string;
  attribution: string;
  /** Persisted source evidence for reviewed external imports. */
  sourceProvider?: string;
  providerExternalId?: string;
  sourceUrl?: string;
  permalink?: string;
  rightsEvidenceUrl?: string;
  sourceFileSha256?: string;
  verifiedAt?: string;
  notes?: string;
  isCurrent: boolean;
  supersededAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogRecord extends AuditLog {
  id: string;
}

export type LibraryEntity = ReadingProgressRecord | ReadingHistoryRecord | BookmarkRecord | HighlightRecord | CollectionRecord | ReviewRecord | ReviewLikeRecord | ReviewCommentRecord | RightsRecord | AuditLogRecord;
