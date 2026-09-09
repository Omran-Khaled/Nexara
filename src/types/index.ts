export type LanguageCode = 'en' | 'ar' | 'fr' | 'de' | 'es' | 'ru' | 'fa' | 'el' | 'la' | 'it' | 'zh' | 'ja' | 'tr' | 'ur';

/**
 * Client-side role mirror used for rendering gates only. The server is the
 * permission authority (`server/auth/AuthorizationRepository.ts`) and only
 * ever emits READER | MODERATOR | ADMIN via `primaryUserRole`.
 * GUEST is the local sentinel written by `endAuthenticatedSession`.
 */
export type UserRole =
  | 'GUEST'
  | 'READER'
  | 'MODERATOR'
  | 'ADMIN';

export type RightsStatus =
  | 'PUBLIC_DOMAIN'
  | 'LICENSED'
  | 'OPEN_ACCESS'
  | 'PREVIEW_ONLY'
  | 'RESTRICTED'
  | 'UNAVAILABLE';

export type FileFormat = 'PDF' | 'EPUB' | 'TXT' | 'HTML';

/**
 * Distinguishes actual readable source text from catalogue metadata and samples.
 * Only FULL_TEXT and PREVIEW may enter the in-app reader.
 */
export type ContentAvailability = 'FULL_TEXT' | 'PREVIEW' | 'METADATA_ONLY' | 'UNAVAILABLE';

export type ReadingDifficulty = 'Accessible' | 'Moderate' | 'Demanding' | 'Scholar';

export type ForestRegionId =
  | 'philosophy'
  | 'ancient-grove'
  | 'poetry'
  | 'archive-woods'
  | 'river-of-stories'
  | 'midnight-library'
  | 'open-fields';

export type WorkflowStatus =
  | 'DRAFT'
  | 'METADATA_REVIEW'
  | 'RIGHTS_VERIFICATION'
  | 'FILE_VALIDATION'
  | 'EDITORIAL_REVIEW'
  | 'PUBLISHED'
  | 'ARCHIVED';

export type ReaderFontFamily = 'serif' | 'sans' | 'literary' | 'mono' | 'amiri' | 'amiri-quran';

export type QuoteCardTheme = 'forest' | 'night' | 'midnight' | 'parchment' | 'burgundy' | 'crimson' | 'minimal';

export type ReaderTheme = 'paper' | 'night' | 'forest';

export type SoundscapeType = 'rain' | 'night-forest' | 'fireplace' | 'wind' | 'library' | 'silence';

export interface Author {
  id: string;
  name: string;
  nameAr: string;
  slug: string;
  avatar: string;
  birthYear: number;
  deathYear?: number;
  era: string;
  eraAr: string;
  country: string;
  countryAr: string;
  bio: string;
  bioAr: string;
  timeline: { year: number; event: string; eventAr: string }[];
  languages: LanguageCode[];
  relatedAuthorIds: string[];
  followersCount: number;
}

export interface BookFile {
  id: string;
  format: FileFormat;
  /** Required on persisted P4 records; optional here for legacy catalogue fixtures. */
  mimeType?: string;
  storageKey?: string;
  sizeBytes: number;
  checksum?: string;
  sourceUrl?: string;
  storageProvider?: string;
  sizeFormatted: string;
  downloadAllowed: boolean;
  readingAllowed: boolean;
  offlineAllowed: boolean;
  createdAt?: string;
  verifiedAt?: string;
  url?: string;
  sampleText?: string;
}

export interface BookEdition {
  id: string;
  isbn?: string;
  language: LanguageCode;
  languageName: string;
  languageNameAr: string;
  publisher: string;
  publisherAr?: string;
  publicationYear: number;
  translator?: string;
  translatorAr?: string;
  pageCount: number;
  estimatedMinutes: number;
  rightsStatus: RightsStatus;
  licenseType: string;
  copyrightHolder?: string;
  source: string;
  attribution: string;
  territoryRestrictions?: string[];
  files: BookFile[];
}

export interface BookChapter {
  id: string;
  title: string;
  titleAr: string;
  pageNumber: number;
  content: string;
  contentAr: string;
}

export interface Book {
  id: string;
  workId: string;
  slug: string;
  title: string;
  titleAr: string;
  originalTitle?: string;
  authorId: string;
  authorName: string;
  authorNameAr: string;
  coverImage: string;
  description: string;
  descriptionAr: string;
  genres: string[];
  genresAr: string[];
  categories: string[];
  categoriesAr: string[];
  themes: string[];
  themesAr: string[];
  moods: string[];
  rating: number;
  ratingsCount: number;
  reviewsCount: number;
  downloadsCount: number;
  readsCount: number;
  featured: boolean;
  hiddenGem: boolean;
  editorialPick: boolean;
  forestRegion: ForestRegionId;
  forestCoords: { x: number; y: number }; // 0 to 100 percentages in forest map
  readingDifficulty: ReadingDifficulty;
  primaryLanguage: LanguageCode;
  publicationYear: number;
  editions: BookEdition[];
  chapters: BookChapter[];
  /** Number of chapters when catalog returns lightweight chapter stubs. */
  chapterCount?: number;
  /** Truthful availability of the content bundled or retrieved for this record. */
  contentAvailability: ContentAvailability;
  workflowStatus: 'DRAFT' | 'METADATA_REVIEW' | 'RIGHTS_VERIFICATION' | 'FILE_VALIDATION' | 'EDITORIAL_REVIEW' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export interface Bookmark {
  id: string;
  bookId: string;
  editionId: string;
  chapterIndex: number;
  progressPercent: number;
  title: string;
  createdAt: string;
}

export type HighlightColor = 'gold' | 'moss' | 'burgundy' | 'blue';

export interface Highlight {
  id: string;
  bookId: string;
  bookTitle: string;
  authorName: string;
  chapterIndex: number;
  chapterTitle: string;
  selectedText: string;
  color: HighlightColor;
  note?: string;
  createdAt: string;
}

export interface ReadingProgress {
  bookId: string;
  editionId: string;
  currentChapterIndex: number;
  currentScrollPercent: number;
  completedPercent: number;
  lastReadAt: string;
  totalSecondsSpent: number;
  completed: boolean;
}

export interface ReadingPathStep {
  id: string;
  stepTitle: string;
  stepTitleAr: string;
  estimatedMinutes: number;
  curatorNote: string;
  curatorNoteAr: string;
  bookId: string;
}

export interface ReadingPath {
  id: string;
  slug: string;
  title: string;
  titleAr: string;
  subtitle: string;
  subtitleAr: string;
  description: string;
  descriptionAr: string;
  coverImage: string;
  curator: string;
  estimatedHours: number;
  bookIds: string[];
  regionId: ForestRegionId;
  order: number;
  /** Optional editorial difficulty badge; absent when the path does not publish one. */
  difficulty?: ReadingDifficulty;
  /** Optional structured milestones; absent for paths that only list books. */
  steps?: ReadingPathStep[];
}

export interface Review {
  id: string;
  bookId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  rating: number;
  title: string;
  content: string;
  createdAt: string;
  /** Aggregate persisted on the server, never a client-side counter. */
  likes: number;
  /** Count of persisted discussion replies. Older records without this field normalize to zero at the API boundary. */
  commentsCount?: number;
  /** Present only when the API can resolve the authenticated viewer. */
  likedByCurrentUser?: boolean;
  isVerifiedReader: boolean;
}

export interface ReviewComment {
  id: string;
  reviewId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: string;
  createdAt: string;
}

export interface ReadingHistoryEntry {
  id: string;
  userId: string;
  bookId: string;
  editionId: string;
  event: 'OPENED' | 'PROGRESS_SAVED' | 'COMPLETED';
  occurredAt: string;
}

export interface UserCollection {
  id: string;
  title: string;
  description?: string;
  isPublic: boolean;
  bookIds: string[];
  createdAt: string;
  colorTheme: string;
}

export interface Achievement {
  id: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  iconName: string;
  unlockedAt?: string;
  progress: number;
  maxProgress: number;
}

export interface TimeCapsule {
  id: string;
  bookId: string;
  bookTitle: string;
  coverImage: string;
  unlockDate: string;
  personalNote: string;
  isUnlocked: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: 'BOOK' | 'EDITION' | 'RIGHTS' | 'USER' | 'FILE' | 'COLLECTION' | 'BOOKMARK' | 'HIGHLIGHT' | 'REVIEW' | 'READING_PROGRESS';
  entityId: string;
  resource: string;
  resourceId: string;
  performedBy: string;
  timestamp: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REJECTED';
  details: string;
  changeSummary: string;
  context?: { requestId?: string; idempotencyKey?: string; source?: string };
  before?: unknown;
  after?: unknown;
}

export interface NotificationItem {
  id: string;
  title: string;
  titleAr: string;
  message: string;
  messageAr: string;
  type: 'path_update' | 'book_available' | 'milestone' | 'time_capsule' | 'download' | 'system';
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}
