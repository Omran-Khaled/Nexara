import { Db, Document } from 'mongodb';
import { ensureIndexes } from './indexes';

const P2_MIGRATION_ID = 'p2-core-schema-v1';
const P2_MIGRATION_CHECKSUM = 'p2-core-schema-v1-20260817';
const P3_MIGRATION_ID = 'p3-ingestion-schema-v1';
const P3_MIGRATION_CHECKSUM = 'nexara-p3-ingestion-schema-2026-08-17';
const P4_MIGRATION_ID = 'p4-real-book-file-storage-v1';
const P4_MIGRATION_CHECKSUM = 'nexara-p4-real-book-file-storage-2026-08-18';
const P6_MIGRATION_ID = 'p6-authorized-downloads-v1';
const P6_MIGRATION_CHECKSUM = 'nexara-p6-authorized-downloads-2026-08-18';
const P8_MIGRATION_ID = 'p8-authorization-roles-v1';
const P8_MIGRATION_CHECKSUM = 'nexara-p8-authorization-roles-2026-08-18';
const P8_DOWNLOAD_LOG_MIGRATION_ID = 'p8-download-log-epub-v1';
const P8_DOWNLOAD_LOG_MIGRATION_CHECKSUM = 'nexara-p8-download-log-epub-2026-08-18';
const P11_COMMUNITY_MIGRATION_ID = 'p11-community-personalization-v1';
const P11_COMMUNITY_MIGRATION_CHECKSUM = 'nexara-p11-community-personalization-2026-08-18';
const P15_CATALOG_MIGRATION_ID = 'p15-real-initial-catalog-v1';
const P15_CATALOG_MIGRATION_CHECKSUM = 'nexara-p15-real-initial-catalog-2026-08-18';

const object = (required: string[], properties: Document = {}): Document => ({ $jsonSchema: { bsonType: 'object', required, properties, additionalProperties: true } });
const string = { bsonType: 'string' };
const bool = { bsonType: 'bool' };
const integer = { bsonType: ['int', 'long', 'double', 'decimal'] };

const validators: Record<string, Document> = {
  users: object(['id', 'email', 'role', 'status', 'createdAt', 'updatedAt'], { id: string, email: string, role: { enum: ['READER', 'EDITOR', 'ADMIN'] }, status: { enum: ['ACTIVE', 'SUSPENDED', 'DELETED'] }, createdAt: string, updatedAt: string }),
  authors: object(['id', 'slug', 'name', 'nameAr', 'createdAt', 'updatedAt'], { id: string, slug: string, name: string, nameAr: string, createdAt: string, updatedAt: string }),
  works: object(['id', 'authorId', 'slug', 'title', 'titleAr', 'description', 'descriptionAr', 'primaryLanguage', 'createdAt', 'updatedAt'], { id: string, authorId: string, slug: string, title: string, titleAr: string, description: string, descriptionAr: string, primaryLanguage: string, createdAt: string, updatedAt: string }),
  books: object(['id', 'workId', 'authorId', 'slug', 'title', 'titleAr', 'editions', 'chapters', 'contentAvailability', 'workflowStatus', 'createdAt', 'updatedAt'], { id: string, workId: string, authorId: string, slug: string, editions: { bsonType: 'array' }, chapters: { bsonType: 'array' }, contentAvailability: { enum: ['FULL_TEXT', 'PREVIEW', 'METADATA_ONLY', 'UNAVAILABLE'] }, workflowStatus: { enum: ['DRAFT', 'METADATA_REVIEW', 'RIGHTS_VERIFICATION', 'FILE_VALIDATION', 'EDITORIAL_REVIEW', 'PUBLISHED', 'ARCHIVED'] }, createdAt: string, updatedAt: string }),
  editions: object(['id', 'bookId', 'workId', 'authorId', 'language', 'rightsStatus', 'createdAt', 'updatedAt'], { id: string, bookId: string, workId: string, authorId: string, language: string, rightsStatus: { enum: ['PUBLIC_DOMAIN', 'LICENSED', 'OPEN_ACCESS', 'PREVIEW_ONLY', 'RESTRICTED', 'UNAVAILABLE'] }, createdAt: string, updatedAt: string }),
  book_files: object(['id', 'bookId', 'editionId', 'format', 'downloadAllowed', 'readingAllowed', 'offlineAllowed', 'createdAt', 'updatedAt'], { id: string, bookId: string, editionId: string, format: { enum: ['PDF', 'TXT', 'HTML'] }, downloadAllowed: bool, readingAllowed: bool, offlineAllowed: bool, createdAt: string, updatedAt: string }),
  chapters: object(['id', 'bookId', 'editionId', 'sequence', 'title', 'titleAr', 'content', 'contentAr', 'createdAt', 'updatedAt'], { id: string, bookId: string, editionId: string, sequence: integer, title: string, titleAr: string, content: string, contentAr: string, createdAt: string, updatedAt: string }),
  rights_records: object(['id', 'bookId', 'status', 'licenseType', 'source', 'evidence', 'verificationMethod', 'territory', 'attribution', 'isCurrent', 'createdAt', 'updatedAt'], { id: string, bookId: string, status: { enum: ['PUBLIC_DOMAIN', 'LICENSED', 'OPEN_ACCESS', 'PREVIEW_ONLY', 'RESTRICTED', 'UNAVAILABLE'] }, licenseType: string, source: string, evidence: string, verificationMethod: { enum: ['MANUAL_REVIEW', 'LICENSE_DOCUMENT', 'PROVIDER_ASSERTION', 'RIGHTS_DATABASE', 'UNVERIFIED_LEGACY'] }, territory: string, attribution: string, isCurrent: bool, createdAt: string, updatedAt: string }),
  reading_progress: object(['id', 'userId', 'bookId', 'editionId', 'clientSequence', 'clientUpdatedAt'], { id: string, userId: string, bookId: string, editionId: string, clientSequence: integer, clientUpdatedAt: string }),
  reading_history: object(['id', 'userId', 'bookId', 'editionId', 'event', 'occurredAt'], { id: string, userId: string, bookId: string, editionId: string, event: { enum: ['OPENED', 'PROGRESS_SAVED', 'COMPLETED'] }, occurredAt: string }),
  bookmarks: object(['id', 'userId', 'bookId', 'editionId', 'chapterIndex', 'createdAt'], { id: string, userId: string, bookId: string, editionId: string, chapterIndex: integer, createdAt: string }),
  highlights: object(['id', 'userId', 'bookId', 'chapterIndex', 'selectedText', 'color', 'createdAt'], { id: string, userId: string, bookId: string, chapterIndex: integer, selectedText: string, color: string, createdAt: string }),
  collections: object(['id', 'userId', 'title', 'bookIds', 'createdAt'], { id: string, userId: string, title: string, bookIds: { bsonType: 'array' }, createdAt: string }),
  reviews: object(['id', 'userId', 'bookId', 'rating', 'title', 'content', 'createdAt'], { id: string, userId: string, bookId: string, rating: integer, title: string, content: string, createdAt: string }),
  user_achievements: object(['id', 'userId', 'title', 'titleAr', 'progress', 'maxProgress', 'updatedAt'], { id: string, userId: string, title: string, titleAr: string, progress: integer, maxProgress: integer, updatedAt: string }),
  notifications: object(['id', 'userId', 'title', 'titleAr', 'message', 'messageAr', 'read', 'createdAt'], { id: string, userId: string, title: string, titleAr: string, message: string, messageAr: string, read: bool, createdAt: string }),
  audit_logs: object(['id', 'action', 'entityType', 'entityId', 'timestamp', 'status'], { id: string, action: string, entityType: string, entityId: string, timestamp: string, status: string }),
  download_logs: object(['id', 'userId', 'bookId', 'editionId', 'fileId', 'format', 'downloadedAt', 'rightsRecordId'], { id: string, userId: string, bookId: string, editionId: string, fileId: string, format: { enum: ['PDF', 'TXT', 'HTML'] }, downloadedAt: string, rightsRecordId: string }),
  discovery_cache: object(['id', 'provider', 'normalizedQuery', 'page', 'limit', 'records', 'expiresAt', 'createdAt'], { id: string, provider: string, normalizedQuery: string, page: integer, limit: integer, records: { bsonType: 'array' }, expiresAt: { bsonType: 'date' }, createdAt: string }),
  provider_records: object(['id', 'provider', 'externalId', 'payload', 'fetchedAt', 'updatedAt'], { id: string, provider: string, externalId: string, payload: { bsonType: 'object' }, fetchedAt: string, updatedAt: string }),
  schema_migrations: object(['id', 'checksum', 'appliedAt'], { id: string, checksum: string, appliedAt: string }),
};

const ingestionJobValidator = object(['id', 'provider', 'providerExternalId', 'requestedBy', 'requestedAt', 'status', 'stages', 'createdAt', 'updatedAt'], { id: string, provider: { enum: ['Gutenberg', 'OpenLibrary', 'InternetArchive'] }, providerExternalId: string, requestedBy: string, requestedAt: string, status: { enum: ['DISCOVERED', 'BLOCKED', 'READY_FOR_REVIEW', 'PERSISTED', 'PUBLISHED', 'FAILED'] }, stages: { bsonType: 'array' }, createdAt: string, updatedAt: string });
const p15IngestionJobValidator = object(['id', 'provider', 'providerExternalId', 'requestedBy', 'requestedAt', 'status', 'stages', 'createdAt', 'updatedAt'], { id: string, provider: { enum: ['Gutenberg', 'OpenLibrary', 'InternetArchive', 'StandardEbooks'] }, providerExternalId: string, requestedBy: string, requestedAt: string, status: { enum: ['DISCOVERED', 'BLOCKED', 'READY_FOR_REVIEW', 'PERSISTED', 'PUBLISHED', 'FAILED'] }, stages: { bsonType: 'array' }, createdAt: string, updatedAt: string });
const p15CatalogAssetValidator = object(['id', 'bookId', 'kind', 'storageKey', 'mimeType', 'sizeBytes', 'checksum', 'sourceUrl', 'storageProvider', 'createdAt', 'updatedAt'], { id: string, bookId: string, kind: { enum: ['COVER'] }, storageKey: string, mimeType: string, sizeBytes: integer, checksum: string, sourceUrl: string, storageProvider: string, createdAt: string, updatedAt: string });

const bookFileValidator = object(['id', 'bookId', 'editionId', 'format', 'mimeType', 'storageKey', 'sizeBytes', 'checksum', 'storageProvider', 'downloadAllowed', 'readingAllowed', 'offlineAllowed', 'createdAt', 'updatedAt', 'verifiedAt'], { id: string, bookId: string, editionId: string, format: { enum: ['PDF', 'TXT', 'HTML'] }, mimeType: string, storageKey: string, sizeBytes: integer, checksum: string, sourceUrl: string, storageProvider: string, downloadAllowed: bool, readingAllowed: bool, offlineAllowed: bool, createdAt: string, updatedAt: string, verifiedAt: string });
const p6BookFileValidator = object(['id', 'bookId', 'editionId', 'format', 'mimeType', 'storageKey', 'sizeBytes', 'checksum', 'storageProvider', 'downloadAllowed', 'readingAllowed', 'offlineAllowed', 'createdAt', 'updatedAt', 'verifiedAt'], { id: string, bookId: string, editionId: string, format: { enum: ['PDF', 'EPUB', 'TXT', 'HTML'] }, mimeType: string, storageKey: string, sizeBytes: integer, checksum: string, sourceUrl: string, storageProvider: string, downloadAllowed: bool, readingAllowed: bool, offlineAllowed: bool, createdAt: string, updatedAt: string, verifiedAt: string });
const p8UserValidator = object(['id', 'email', 'role', 'status', 'createdAt', 'updatedAt'], { id: string, email: string, role: { enum: ['READER', 'MODERATOR', 'ADMIN'] }, status: { enum: ['ACTIVE', 'SUSPENDED', 'DELETED'] }, createdAt: string, updatedAt: string });
const roleAssignmentValidator = object(['id', 'userId', 'role', 'assignedBy', 'createdAt'], { id: string, userId: string, role: { enum: ['READER', 'MODERATOR', 'ADMIN'] }, assignedBy: string, createdAt: string });
const p8DownloadLogValidator = object(['id', 'userId', 'bookId', 'editionId', 'fileId', 'format', 'downloadedAt', 'rightsRecordId'], { id: string, userId: string, bookId: string, editionId: string, fileId: string, format: { enum: ['PDF', 'EPUB', 'TXT', 'HTML'] }, downloadedAt: string, rightsRecordId: string });
const p11ReviewValidator = object(['id', 'userId', 'bookId', 'rating', 'title', 'content', 'createdAt', 'likes', 'commentsCount', 'isVerifiedReader'], { id: string, userId: string, bookId: string, rating: integer, title: string, content: string, createdAt: string, likes: integer, commentsCount: integer, isVerifiedReader: bool });
const p11ReviewLikeValidator = object(['id', 'reviewId', 'userId', 'createdAt'], { id: string, reviewId: string, userId: string, createdAt: string });
const p11ReviewCommentValidator = object(['id', 'reviewId', 'userId', 'userName', 'userAvatar', 'content', 'createdAt'], { id: string, reviewId: string, userId: string, userName: string, userAvatar: string, content: string, createdAt: string });

async function ensureCollectionValidator(db: Db, name: string, validator: Document): Promise<void> {
  try {
    await db.createCollection(name, { validator, validationLevel: 'strict', validationAction: 'error' });
  } catch (error: unknown) {
    if ((error as { code?: number }).code !== 48) throw error;
    await db.command({ collMod: name, validator, validationLevel: 'strict', validationAction: 'error' });
  }
}

export async function applyP2Migrations(db: Db): Promise<{ applied: boolean; migrationId: string }> {
  const migrations = db.collection<{ id: string; checksum: string; appliedAt: string }>('schema_migrations');
  const existing = await migrations.findOne({ id: P2_MIGRATION_ID }, { projection: { _id: 0 } });
  if (existing) {
    if (existing.checksum !== P2_MIGRATION_CHECKSUM) throw new Error(`Migration checksum mismatch for ${P2_MIGRATION_ID}.`);
    await ensureIndexes(db);
    return { applied: false, migrationId: P2_MIGRATION_ID };
  }

  for (const [name, validator] of Object.entries(validators)) await ensureCollectionValidator(db, name, validator);
  await ensureIndexes(db);
  await migrations.insertOne({ id: P2_MIGRATION_ID, checksum: P2_MIGRATION_CHECKSUM, appliedAt: new Date().toISOString() });
  return { applied: true, migrationId: P2_MIGRATION_ID };
}

export async function applyP8AuthorizationMigration(db: Db): Promise<{ applied: boolean; migrationId: string }> {
  await applyP6AuthorizedDownloadMigration(db);
  const migrations = db.collection<{ id: string; checksum: string; appliedAt: string }>('schema_migrations');
  const existing = await migrations.findOne({ id: P8_MIGRATION_ID }, { projection: { _id: 0 } });
  if (existing) {
    if (existing.checksum !== P8_MIGRATION_CHECKSUM) throw new Error(`Migration checksum mismatch for ${P8_MIGRATION_ID}.`);
    await ensureCollectionValidator(db, 'users', p8UserValidator); await ensureCollectionValidator(db, 'role_assignments', roleAssignmentValidator); await ensureIndexes(db);
    return { applied: false, migrationId: P8_MIGRATION_ID };
  }
  await ensureCollectionValidator(db, 'users', p8UserValidator); await ensureCollectionValidator(db, 'role_assignments', roleAssignmentValidator); await ensureIndexes(db);
  await migrations.insertOne({ id: P8_MIGRATION_ID, checksum: P8_MIGRATION_CHECKSUM, appliedAt: new Date().toISOString() });
  return { applied: true, migrationId: P8_MIGRATION_ID };
}

export async function applyP11CommunityMigration(db: Db): Promise<{ applied: boolean; migrationId: string }> {
  await applyP8CurrentMigration(db);
  const migrations = db.collection<{ id: string; checksum: string; appliedAt: string }>('schema_migrations');
  const existing = await migrations.findOne({ id: P11_COMMUNITY_MIGRATION_ID }, { projection: { _id: 0 } });
  if (existing) {
    if (existing.checksum !== P11_COMMUNITY_MIGRATION_CHECKSUM) throw new Error(`Migration checksum mismatch for ${P11_COMMUNITY_MIGRATION_ID}.`);
    await ensureCollectionValidator(db, 'reviews', p11ReviewValidator); await ensureCollectionValidator(db, 'review_likes', p11ReviewLikeValidator); await ensureCollectionValidator(db, 'review_comments', p11ReviewCommentValidator); await ensureIndexes(db);
    return { applied: false, migrationId: P11_COMMUNITY_MIGRATION_ID };
  }
  await ensureCollectionValidator(db, 'reviews', p11ReviewValidator); await ensureCollectionValidator(db, 'review_likes', p11ReviewLikeValidator); await ensureCollectionValidator(db, 'review_comments', p11ReviewCommentValidator); await ensureIndexes(db);
  await migrations.insertOne({ id: P11_COMMUNITY_MIGRATION_ID, checksum: P11_COMMUNITY_MIGRATION_CHECKSUM, appliedAt: new Date().toISOString() });
  return { applied: true, migrationId: P11_COMMUNITY_MIGRATION_ID };
}

export async function applyP15CatalogMigration(db: Db): Promise<{ applied: boolean; migrationId: string }> {
  await applyP11CommunityMigration(db);
  const migrations = db.collection<{ id: string; checksum: string; appliedAt: string }>('schema_migrations');
  const existing = await migrations.findOne({ id: P15_CATALOG_MIGRATION_ID }, { projection: { _id: 0 } });
  if (existing) {
    if (existing.checksum !== P15_CATALOG_MIGRATION_CHECKSUM) throw new Error(`Migration checksum mismatch for ${P15_CATALOG_MIGRATION_ID}.`);
    await ensureCollectionValidator(db, 'ingestion_jobs', p15IngestionJobValidator); await ensureCollectionValidator(db, 'catalog_assets', p15CatalogAssetValidator); await db.collection('catalog_assets').createIndex({ id: 1 }, { unique: true }); await db.collection('catalog_assets').createIndex({ bookId: 1, kind: 1 }, { unique: true }); await ensureIndexes(db);
    return { applied: false, migrationId: P15_CATALOG_MIGRATION_ID };
  }
  await ensureCollectionValidator(db, 'ingestion_jobs', p15IngestionJobValidator); await ensureCollectionValidator(db, 'catalog_assets', p15CatalogAssetValidator); await db.collection('catalog_assets').createIndex({ id: 1 }, { unique: true }); await db.collection('catalog_assets').createIndex({ bookId: 1, kind: 1 }, { unique: true }); await ensureIndexes(db);
  await migrations.insertOne({ id: P15_CATALOG_MIGRATION_ID, checksum: P15_CATALOG_MIGRATION_CHECKSUM, appliedAt: new Date().toISOString() });
  return { applied: true, migrationId: P15_CATALOG_MIGRATION_ID };
}

export async function applyP8CurrentMigration(db: Db): Promise<{ applied: boolean; migrationId: string }> {
  await applyP8AuthorizationMigration(db);
  const migrations = db.collection<{ id: string; checksum: string; appliedAt: string }>('schema_migrations');
  const existing = await migrations.findOne({ id: P8_DOWNLOAD_LOG_MIGRATION_ID }, { projection: { _id: 0 } });
  if (existing) {
    if (existing.checksum !== P8_DOWNLOAD_LOG_MIGRATION_CHECKSUM) throw new Error(`Migration checksum mismatch for ${P8_DOWNLOAD_LOG_MIGRATION_ID}.`);
    await ensureCollectionValidator(db, 'download_logs', p8DownloadLogValidator); await ensureIndexes(db);
    return { applied: false, migrationId: P8_DOWNLOAD_LOG_MIGRATION_ID };
  }
  await ensureCollectionValidator(db, 'download_logs', p8DownloadLogValidator); await ensureIndexes(db);
  await migrations.insertOne({ id: P8_DOWNLOAD_LOG_MIGRATION_ID, checksum: P8_DOWNLOAD_LOG_MIGRATION_CHECKSUM, appliedAt: new Date().toISOString() });
  return { applied: true, migrationId: P8_DOWNLOAD_LOG_MIGRATION_ID };
}

export async function applyP6AuthorizedDownloadMigration(db: Db): Promise<{ applied: boolean; migrationId: string }> {
  await applyP4BookFileMigration(db);
  const migrations = db.collection<{ id: string; checksum: string; appliedAt: string }>('schema_migrations');
  const existing = await migrations.findOne({ id: P6_MIGRATION_ID }, { projection: { _id: 0 } });
  if (existing) {
    if (existing.checksum !== P6_MIGRATION_CHECKSUM) throw new Error(`Migration checksum mismatch for ${P6_MIGRATION_ID}.`);
    await ensureCollectionValidator(db, 'book_files', p6BookFileValidator); await ensureIndexes(db);
    return { applied: false, migrationId: P6_MIGRATION_ID };
  }
  await ensureCollectionValidator(db, 'book_files', p6BookFileValidator); await ensureIndexes(db);
  await migrations.insertOne({ id: P6_MIGRATION_ID, checksum: P6_MIGRATION_CHECKSUM, appliedAt: new Date().toISOString() });
  return { applied: true, migrationId: P6_MIGRATION_ID };
}

export async function applyP4BookFileMigration(db: Db): Promise<{ applied: boolean; migrationId: string }> {
  await applyP3IngestionMigration(db);
  const migrations = db.collection<{ id: string; checksum: string; appliedAt: string }>('schema_migrations');
  const existing = await migrations.findOne({ id: P4_MIGRATION_ID }, { projection: { _id: 0 } });
  if (existing) {
    if (existing.checksum !== P4_MIGRATION_CHECKSUM) throw new Error(`Migration checksum mismatch for ${P4_MIGRATION_ID}.`);
    await ensureCollectionValidator(db, 'book_files', bookFileValidator); await ensureIndexes(db);
    return { applied: false, migrationId: P4_MIGRATION_ID };
  }
  await ensureCollectionValidator(db, 'book_files', bookFileValidator); await ensureIndexes(db);
  await migrations.insertOne({ id: P4_MIGRATION_ID, checksum: P4_MIGRATION_CHECKSUM, appliedAt: new Date().toISOString() });
  return { applied: true, migrationId: P4_MIGRATION_ID };
}
/** Applies the versioned P3 ingestion-job schema after the canonical P2 schema. */
export async function applyP3IngestionMigration(db: Db): Promise<{ applied: boolean; migrationId: string }> {
  await applyP2Migrations(db);
  const migrations = db.collection<{ id: string; checksum: string; appliedAt: string }>('schema_migrations');
  const existing = await migrations.findOne({ id: P3_MIGRATION_ID }, { projection: { _id: 0 } });
  if (existing) {
    if (existing.checksum !== P3_MIGRATION_CHECKSUM) throw new Error(`Migration checksum mismatch for ${P3_MIGRATION_ID}.`);
    await ensureCollectionValidator(db, 'ingestion_jobs', ingestionJobValidator);
    await ensureIndexes(db);
    return { applied: false, migrationId: P3_MIGRATION_ID };
  }
  await ensureCollectionValidator(db, 'ingestion_jobs', ingestionJobValidator);
  await ensureIndexes(db);
  await migrations.insertOne({ id: P3_MIGRATION_ID, checksum: P3_MIGRATION_CHECKSUM, appliedAt: new Date().toISOString() });
  return { applied: true, migrationId: P3_MIGRATION_ID };
}
