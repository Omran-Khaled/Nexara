import { Db } from "mongodb";

/**
 * Creates indexes required by the P2 schema. Collection validators are applied by the
 * migration runner so deployment can version and audit validator changes separately.
 */
export async function ensureIndexes(db: Db): Promise<void> {
  await db.collection("schema_migrations").createIndexes([
    { key: { id: 1 }, name: "schema_migration_id_unique", unique: true },
    { key: { appliedAt: -1 }, name: "schema_migration_applied_at" },
  ]);
  await db.collection("ingestion_jobs").createIndexes([
    { key: { id: 1 }, name: "ingestion_job_id_unique", unique: true },
    {
      key: { provider: 1, providerExternalId: 1 },
      name: "ingestion_provider_external_unique",
      unique: true,
      partialFilterExpression: {
        status: {
          $in: ["DISCOVERED", "READY_FOR_REVIEW", "PERSISTED", "PUBLISHED"],
        },
      },
    },
    { key: { status: 1, updatedAt: -1 }, name: "ingestion_status_updated" },
    {
      key: { requestedBy: 1, requestedAt: -1 },
      name: "ingestion_requester_time",
    },
  ]);

  await db.collection("users").createIndexes([
    { key: { id: 1 }, name: "users_id_unique", unique: true },
    {
      key: { email: 1 },
      name: "users_email_unique",
      unique: true,
      sparse: true,
    },
    {
      key: { role: 1, status: 1, updatedAt: -1 },
      name: "users_role_status_updated",
    },
  ]);
  await db.collection("authors").createIndexes([
    { key: { id: 1 }, name: "authors_id_unique", unique: true },
    { key: { slug: 1 }, name: "authors_slug_unique", unique: true },
    {
      key: { name: "text", nameAr: "text", bio: "text", bioAr: "text" },
      name: "authors_text_search",
      weights: { name: 10, nameAr: 10, bio: 2, bioAr: 2 },
    },
  ]);
  await db.collection("works").createIndexes([
    { key: { id: 1 }, name: "works_id_unique", unique: true },
    { key: { slug: 1 }, name: "works_slug_unique", unique: true },
    { key: { authorId: 1, updatedAt: -1 }, name: "works_author_updated" },
    {
      key: {
        title: "text",
        titleAr: "text",
        description: "text",
        descriptionAr: "text",
      },
      name: "works_text_search",
      weights: { title: 10, titleAr: 10, description: 2, descriptionAr: 2 },
    },
  ]);
  await db.collection("books").createIndexes([
    { key: { id: 1 }, name: "books_id_unique", unique: true },
    { key: { slug: 1 }, name: "books_slug_unique", unique: true },
    { key: { workId: 1 }, name: "books_work" },
    { key: { authorId: 1 }, name: "books_author" },
    {
      key: { "editions.isbn": 1 },
      name: "books_edition_isbn_unique",
      unique: true,
      sparse: true,
    },
    {
      key: { workflowStatus: 1, contentAvailability: 1 },
      name: "books_status_availability",
    },
    { key: { "editions.rightsStatus": 1 }, name: "books_rights_status" },
    { key: { forestRegion: 1 }, name: "books_region" },
    {
      key: {
        title: "text",
        titleAr: "text",
        authorName: "text",
        authorNameAr: "text",
        description: "text",
        descriptionAr: "text",
      },
      name: "books_text_search",
      weights: {
        title: 10,
        titleAr: 10,
        authorName: 6,
        authorNameAr: 6,
        description: 2,
        descriptionAr: 2,
      },
    },
  ]);
  await db.collection("editions").createIndexes([
    { key: { id: 1 }, name: "editions_id_unique", unique: true },
    {
      key: { isbn: 1 },
      name: "editions_isbn_unique",
      unique: true,
      sparse: true,
    },
    { key: { bookId: 1, workId: 1 }, name: "editions_book_work" },
    { key: { bookId: 1, language: 1 }, name: "editions_book_language" },
  ]);
  await db.collection("book_files").createIndexes([
    { key: { id: 1 }, name: "book_files_id_unique", unique: true },
    {
      key: { editionId: 1, format: 1 },
      name: "book_files_edition_format_unique",
      unique: true,
    },
    { key: { bookId: 1, editionId: 1 }, name: "book_files_book_edition" },
  ]);
  await db.collection("chapters").createIndexes([
    { key: { id: 1 }, name: "chapters_id_unique", unique: true },
    {
      key: { editionId: 1, sequence: 1 },
      name: "chapters_edition_sequence_unique",
      unique: true,
    },
    { key: { bookId: 1, editionId: 1 }, name: "chapters_book_edition" },
    {
      key: {
        title: "text",
        titleAr: "text",
        content: "text",
        contentAr: "text",
      },
      name: "chapters_text_search",
      weights: { title: 8, titleAr: 8, content: 1, contentAr: 1 },
    },
  ]);

  await db.collection("reading_progress").createIndexes([
    { key: { id: 1 }, name: "progress_id_unique", unique: true },
    {
      key: { userId: 1, bookId: 1, editionId: 1 },
      name: "progress_user_book_edition_unique",
      unique: true,
    },
    { key: { userId: 1, lastReadAt: -1 }, name: "progress_user_last_read" },
  ]);
  await db.collection("reading_history").createIndexes([
    { key: { id: 1 }, name: "reading_history_id_unique", unique: true },
    {
      key: { userId: 1, bookId: 1, occurredAt: -1 },
      name: "reading_history_user_book_time",
    },
    { key: { bookId: 1, occurredAt: -1 }, name: "reading_history_book_time" },
  ]);
  await db.collection("bookmarks").createIndexes([
    { key: { id: 1 }, name: "bookmark_id_unique", unique: true },
    {
      key: { userId: 1, bookId: 1, editionId: 1, chapterIndex: 1 },
      name: "bookmark_position_unique",
      unique: true,
    },
    { key: { userId: 1, createdAt: -1 }, name: "bookmark_user_created" },
  ]);
  await db.collection("highlights").createIndexes([
    { key: { id: 1 }, name: "highlight_id_unique", unique: true },
    {
      key: { userId: 1, bookId: 1, createdAt: -1 },
      name: "highlight_user_book_created",
    },
  ]);
  await db.collection("collections").createIndexes([
    { key: { id: 1 }, name: "collection_id_unique", unique: true },
    {
      key: { userId: 1, title: 1 },
      name: "collection_user_title_unique",
      unique: true,
    },
  ]);
  await db.collection("reviews").createIndexes([
    { key: { id: 1 }, name: "review_id_unique", unique: true },
    {
      key: { bookId: 1, userId: 1 },
      name: "review_book_user_unique",
      unique: true,
    },
    { key: { bookId: 1, createdAt: -1 }, name: "review_book_created" },
    { key: { createdAt: -1 }, name: "review_community_feed_created" },
  ]);
  await db.collection("review_likes").createIndexes([
    { key: { id: 1 }, name: "review_like_id_unique", unique: true },
    {
      key: { reviewId: 1, userId: 1 },
      name: "review_like_owner_unique",
      unique: true,
    },
    { key: { reviewId: 1, createdAt: -1 }, name: "review_like_review_time" },
  ]);
  await db.collection("review_comments").createIndexes([
    { key: { id: 1 }, name: "review_comment_id_unique", unique: true },
    { key: { reviewId: 1, createdAt: 1 }, name: "review_comment_thread_time" },
    { key: { userId: 1, createdAt: -1 }, name: "review_comment_owner_time" },
  ]);
  await db.collection("user_book_states").createIndexes([
    { key: { id: 1 }, name: "user_book_state_id_unique", unique: true },
    {
      key: { userId: 1, bookId: 1 },
      name: "user_book_state_owner_book_unique",
      unique: true,
    },
  ]);
  await db.collection("user_achievements").createIndexes([
    { key: { id: 1 }, name: "achievement_id_unique", unique: true },
    { key: { userId: 1, updatedAt: -1 }, name: "achievement_owner_time" },
  ]);
  await db.collection("notifications").createIndexes([
    { key: { id: 1 }, name: "notification_id_unique", unique: true },
    { key: { userId: 1, createdAt: -1 }, name: "notification_owner_time" },
  ]);
  await db.collection("time_capsules").createIndexes([
    { key: { id: 1 }, name: "time_capsule_id_unique", unique: true },
    { key: { userId: 1, createdAt: -1 }, name: "time_capsule_owner_time" },
  ]);

  await db.collection("role_assignments").createIndexes([
    { key: { id: 1 }, name: "role_assignment_id_unique", unique: true },
    {
      key: { userId: 1, role: 1 },
      name: "role_assignment_user_role_unique",
      unique: true,
    },
    { key: { userId: 1, createdAt: -1 }, name: "role_assignment_user_time" },
  ]);
  await db.collection("rights_records").createIndexes([
    { key: { id: 1 }, name: "rights_id_unique", unique: true },
    {
      key: { bookId: 1, editionId: 1, isCurrent: 1 },
      name: "rights_current_book_edition_unique",
      unique: true,
      partialFilterExpression: { isCurrent: true },
    },
    {
      key: { bookId: 1, editionId: 1, status: 1, updatedAt: -1 },
      name: "rights_book_edition_status_updated",
    },
  ]);
  await db.collection("audit_logs").createIndexes([
    { key: { id: 1 }, name: "audit_id_unique", unique: true },
    {
      key: { entityType: 1, entityId: 1, timestamp: -1 },
      name: "audit_entity_timestamp",
    },
  ]);
  await db.collection("download_logs").createIndexes([
    { key: { id: 1 }, name: "download_log_id_unique", unique: true },
    { key: { userId: 1, downloadedAt: -1 }, name: "download_log_user_time" },
    {
      key: { bookId: 1, editionId: 1, downloadedAt: -1 },
      name: "download_log_book_edition_time",
    },
  ]);
  await db.collection("downloads").createIndexes([
    { key: { id: 1 }, name: "download_id_unique", unique: true },
    { key: { userId: 1, downloadedAt: -1 }, name: "download_owner_time" },
  ]);
  await db.collection("provider_records").createIndexes([
    { key: { id: 1 }, name: "provider_record_id_unique", unique: true },
    {
      key: { provider: 1, externalId: 1 },
      name: "provider_external_id_unique",
      unique: true,
    },
    { key: { provider: 1, updatedAt: -1 }, name: "provider_updated" },
  ]);
  await db.collection("discovery_cache").createIndexes([
    { key: { id: 1 }, name: "discovery_cache_id_unique", unique: true },
    {
      key: { provider: 1, normalizedQuery: 1, page: 1, limit: 1 },
      name: "discovery_cache_query_unique",
      unique: true,
    },
    {
      key: { expiresAt: 1 },
      name: "discovery_cache_ttl",
      expireAfterSeconds: 0,
    },
  ]);
}
