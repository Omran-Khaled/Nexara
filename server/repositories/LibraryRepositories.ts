import { Collection, Db } from 'mongodb';
import { AuditLogRecord, BookmarkRecord, CollectionRecord, HighlightRecord, ReadingHistoryRecord, ReadingProgressRecord, ReviewCommentRecord, ReviewLikeRecord, ReviewRecord, RightsRecord } from '../models/library';
import { DatabaseError } from '../errors/ApplicationErrors';

export interface ReadingProgressRepository { upsert(record: ReadingProgressRecord): Promise<ReadingProgressRecord>; list(userId: string, bookId?: string): Promise<ReadingProgressRecord[]>; }
export interface ReadingHistoryRepository { record(record: ReadingHistoryRecord): Promise<ReadingHistoryRecord>; list(userId: string, limit?: number): Promise<ReadingHistoryRecord[]>; }
export interface BookmarkRepository { create(record: BookmarkRecord): Promise<BookmarkRecord>; list(userId: string, bookId?: string): Promise<BookmarkRecord[]>; delete(id: string, userId: string): Promise<boolean>; }
export interface HighlightRepository { create(record: HighlightRecord): Promise<HighlightRecord>; list(userId: string, bookId?: string): Promise<HighlightRecord[]>; updateNote(id: string, userId: string, note: string): Promise<HighlightRecord | null>; delete(id: string, userId: string): Promise<boolean>; }
export interface CollectionRepository { create(record: CollectionRecord): Promise<CollectionRecord>; list(userId: string): Promise<CollectionRecord[]>; updateBookIds(id: string, userId: string, bookIds: string[]): Promise<CollectionRecord | null>; delete(id: string, userId: string): Promise<boolean>; }
export interface ReviewRepository {
  create(record: ReviewRecord): Promise<ReviewRecord>;
  findById(id: string): Promise<ReviewRecord | null>;
  listByBook(bookId: string): Promise<ReviewRecord[]>;
  listFeed(limit: number): Promise<ReviewRecord[]>;
  setLike(reviewId: string, userId: string, liked: boolean): Promise<{ likes: number; liked: boolean }>;
  isLiked(reviewId: string, userId: string): Promise<boolean>;
  createComment(record: ReviewCommentRecord): Promise<ReviewCommentRecord>;
  listComments(reviewId: string): Promise<ReviewCommentRecord[]>;
}
export interface RightsRepository { create(record: RightsRecord): Promise<RightsRecord>; listByBook(bookId: string): Promise<RightsRecord[]>; }
export interface AuditLogRepository { append(record: AuditLogRecord): Promise<AuditLogRecord>; list(entityType?: string, entityId?: string): Promise<AuditLogRecord[]>; }

function copy<T>(value: T): T { return structuredClone(value); }
function toDatabaseError(error: unknown, duplicateCode: string): never { if ((error as { code?: number })?.code === 11000) throw new Error(duplicateCode); throw new DatabaseError('Database operation failed.', error); }

export class InMemoryReadingProgressRepository implements ReadingProgressRepository {
  private readonly records = new Map<string, ReadingProgressRecord>();
  private key(value: ReadingProgressRecord) { return `${value.userId}:${value.bookId}:${value.editionId}`; }
  async upsert(record: ReadingProgressRecord) { const key = this.key(record); const existing = this.records.get(key); if (existing && existing.clientSequence >= record.clientSequence) return copy(existing); this.records.set(key, copy(record)); return copy(record); }
  async list(userId: string, bookId?: string) { return [...this.records.values()].filter((x) => x.userId === userId && (!bookId || x.bookId === bookId)).sort((a, b) => b.lastReadAt.localeCompare(a.lastReadAt)).map(copy); }
}
export class InMemoryReadingHistoryRepository implements ReadingHistoryRepository {
  private readonly records = new Map<string, ReadingHistoryRecord>();
  async record(record: ReadingHistoryRecord) { this.records.set(record.id, copy(record)); return copy(record); }
  async list(userId: string, limit = 50) { return [...this.records.values()].filter((x) => x.userId === userId).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, limit).map(copy); }
}
export class InMemoryBookmarkRepository implements BookmarkRepository {
  private readonly records = new Map<string, BookmarkRecord>();
  async create(record: BookmarkRecord) { if ([...this.records.values()].some((x) => x.userId === record.userId && x.bookId === record.bookId && x.editionId === record.editionId && x.chapterIndex === record.chapterIndex)) throw new Error('DUPLICATE_BOOKMARK'); this.records.set(record.id, copy(record)); return copy(record); }
  async list(userId: string, bookId?: string) { return [...this.records.values()].filter((x) => x.userId === userId && (!bookId || x.bookId === bookId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(copy); }
  async delete(id: string, userId: string) { const value = this.records.get(id); return !!value && value.userId === userId && this.records.delete(id); }
}
export class InMemoryHighlightRepository implements HighlightRepository {
  private readonly records = new Map<string, HighlightRecord>();
  async create(record: HighlightRecord) { if (this.records.has(record.id)) throw new Error('DUPLICATE_HIGHLIGHT'); this.records.set(record.id, copy(record)); return copy(record); }
  async list(userId: string, bookId?: string) { return [...this.records.values()].filter((x) => x.userId === userId && (!bookId || x.bookId === bookId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(copy); }
  async updateNote(id: string, userId: string, note: string) { const value = this.records.get(id); if (!value || value.userId !== userId) return null; const next = { ...value, note }; this.records.set(id, next); return copy(next); }
  async delete(id: string, userId: string) { const value = this.records.get(id); return !!value && value.userId === userId && this.records.delete(id); }
}
export class InMemoryCollectionRepository implements CollectionRepository {
  private readonly records = new Map<string, CollectionRecord>();
  async create(record: CollectionRecord) { if ([...this.records.values()].some((x) => x.userId === record.userId && x.title.toLowerCase() === record.title.toLowerCase())) throw new Error('DUPLICATE_COLLECTION'); this.records.set(record.id, copy(record)); return copy(record); }
  async list(userId: string) { return [...this.records.values()].filter((x) => x.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(copy); }
  async updateBookIds(id: string, userId: string, bookIds: string[]) { const value = this.records.get(id); if (!value || value.userId !== userId) return null; const next = { ...value, bookIds: [...bookIds] }; this.records.set(id, copy(next)); return copy(next); }
  async delete(id: string, userId: string) { const value = this.records.get(id); return !!value && value.userId === userId && this.records.delete(id); }
}
export class InMemoryReviewRepository implements ReviewRepository {
  private readonly records = new Map<string, ReviewRecord>();
  private readonly likes = new Map<string, ReviewLikeRecord>();
  private readonly comments = new Map<string, ReviewCommentRecord>();
  async create(record: ReviewRecord) { if ([...this.records.values()].some((x) => x.bookId === record.bookId && x.userId === record.userId)) throw new Error('DUPLICATE_REVIEW'); this.records.set(record.id, copy(record)); return copy(record); }
  async findById(id: string) { const record = this.records.get(id); return record ? copy(record) : null; }
  async listByBook(bookId: string) { return [...this.records.values()].filter((x) => x.bookId === bookId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(copy); }
  async listFeed(limit: number) { return [...this.records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit).map(copy); }
  async setLike(reviewId: string, userId: string, liked: boolean) {
    const review = this.records.get(reviewId); if (!review) throw new Error('REVIEW_NOT_FOUND');
    const key = `${reviewId}:${userId}`; const existing = this.likes.has(key);
    if (liked && !existing) { this.likes.set(key, { id: `review-like-${reviewId}-${userId}`, reviewId, userId, createdAt: new Date().toISOString() }); review.likes += 1; }
    if (!liked && existing) { this.likes.delete(key); review.likes = Math.max(0, review.likes - 1); }
    this.records.set(reviewId, review); return { likes: review.likes, liked: this.likes.has(key) };
  }
  async isLiked(reviewId: string, userId: string) { return this.likes.has(`${reviewId}:${userId}`); }
  async createComment(record: ReviewCommentRecord) { if (!this.records.has(record.reviewId)) throw new Error('REVIEW_NOT_FOUND'); this.comments.set(record.id, copy(record)); const review = this.records.get(record.reviewId)!; review.commentsCount = (review.commentsCount || 0) + 1; this.records.set(review.id, review); return copy(record); }
  async listComments(reviewId: string) { return [...this.comments.values()].filter((x) => x.reviewId === reviewId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(copy); }
}
export class InMemoryRightsRepository implements RightsRepository {
  private readonly records = new Map<string, RightsRecord>();
  async create(record: RightsRecord) { if (this.records.has(record.id)) throw new Error('DUPLICATE_RIGHTS'); if (record.isCurrent && [...this.records.values()].some((x) => x.isCurrent && x.bookId === record.bookId && x.editionId === record.editionId)) throw new Error('DUPLICATE_CURRENT_RIGHTS'); this.records.set(record.id, copy(record)); return copy(record); }
  async listByBook(bookId: string) { return [...this.records.values()].filter((x) => x.bookId === bookId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(copy); }
}
export class InMemoryAuditLogRepository implements AuditLogRepository {
  private readonly records = new Map<string, AuditLogRecord>();
  async append(record: AuditLogRecord) { this.records.set(record.id, copy(record)); return copy(record); }
  async list(entityType?: string, entityId?: string) { return [...this.records.values()].filter((x) => (!entityType || x.entityType === entityType) && (!entityId || x.entityId === entityId)).sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map(copy); }
}

export class MongoReadingProgressRepository implements ReadingProgressRepository {
  private readonly records: Collection<ReadingProgressRecord>; constructor(db: Db) { this.records = db.collection('reading_progress'); }
  async upsert(record: ReadingProgressRecord) {
    const identity = { userId: record.userId, bookId: record.bookId, editionId: record.editionId };
    try {
      const result = await this.records.findOneAndUpdate({ ...identity, $or: [{ clientSequence: { $lt: record.clientSequence } }, { clientSequence: { $exists: false } }] }, { $set: record }, { upsert: true, returnDocument: 'after', projection: { _id: 0 } });
      if (result) return result as ReadingProgressRecord;
      const current = await this.records.findOne(identity, { projection: { _id: 0 } }); if (current) return current as ReadingProgressRecord;
      throw new DatabaseError('Could not read progress after update.');
    } catch (error: unknown) {
      if ((error as { code?: number })?.code === 11000) { const current = await this.records.findOne(identity, { projection: { _id: 0 } }); if (current) return current as ReadingProgressRecord; }
      return toDatabaseError(error, 'DUPLICATE_PROGRESS');
    }
  }
  async list(userId: string, bookId?: string) { try { return await this.records.find({ userId, ...(bookId ? { bookId } : {}) }).project({ _id: 0 }).sort({ lastReadAt: -1 }).toArray() as ReadingProgressRecord[]; } catch (error) { return toDatabaseError(error, 'DATABASE_ERROR'); } }
}
export class MongoReadingHistoryRepository implements ReadingHistoryRepository {
  private readonly records: Collection<ReadingHistoryRecord>; constructor(db: Db) { this.records = db.collection('reading_history'); }
  async record(record: ReadingHistoryRecord) { try { await this.records.insertOne(record); return record; } catch (error) { return toDatabaseError(error, 'DUPLICATE_READING_HISTORY'); } }
  async list(userId: string, limit = 50) { try { return await this.records.find({ userId }).project({ _id: 0 }).sort({ occurredAt: -1 }).limit(limit).toArray() as ReadingHistoryRecord[]; } catch (error) { return toDatabaseError(error, 'DATABASE_ERROR'); } }
}
export class MongoBookmarkRepository implements BookmarkRepository {
  private readonly records: Collection<BookmarkRecord>; constructor(db: Db) { this.records = db.collection('bookmarks'); }
  async create(record: BookmarkRecord) { try { await this.records.insertOne(record); return record; } catch (error) { return toDatabaseError(error, 'DUPLICATE_BOOKMARK'); } }
  async list(userId: string, bookId?: string) { try { return await this.records.find({ userId, ...(bookId ? { bookId } : {}) }).project({ _id: 0 }).sort({ createdAt: -1 }).toArray() as BookmarkRecord[]; } catch (error) { return toDatabaseError(error, 'DATABASE_ERROR'); } }
  async delete(id: string, userId: string) { try { return (await this.records.deleteOne({ id, userId })).deletedCount === 1; } catch (error) { return toDatabaseError(error, 'DATABASE_ERROR'); } }
}
export class MongoHighlightRepository implements HighlightRepository {
  private readonly records: Collection<HighlightRecord>; constructor(db: Db) { this.records = db.collection('highlights'); }
  async create(record: HighlightRecord) { try { await this.records.insertOne(record); return record; } catch (error) { return toDatabaseError(error, 'DUPLICATE_HIGHLIGHT'); } }
  async list(userId: string, bookId?: string) { try { return await this.records.find({ userId, ...(bookId ? { bookId } : {}) }).project({ _id: 0 }).sort({ createdAt: -1 }).toArray() as HighlightRecord[]; } catch (error) { return toDatabaseError(error, 'DATABASE_ERROR'); } }
  async updateNote(id: string, userId: string, note: string) { try { return await this.records.findOneAndUpdate({ id, userId }, { $set: { note } }, { returnDocument: 'after', projection: { _id: 0 } }) as HighlightRecord | null; } catch (error) { return toDatabaseError(error, 'DATABASE_ERROR'); } }
  async delete(id: string, userId: string) { try { return (await this.records.deleteOne({ id, userId })).deletedCount === 1; } catch (error) { return toDatabaseError(error, 'DATABASE_ERROR'); } }
}
export class MongoCollectionRepository implements CollectionRepository {
  private readonly records: Collection<CollectionRecord>; constructor(db: Db) { this.records = db.collection('collections'); }
  async create(record: CollectionRecord) { try { await this.records.insertOne(record); return record; } catch (error) { return toDatabaseError(error, 'DUPLICATE_COLLECTION'); } }
  async list(userId: string) { try { return await this.records.find({ userId }).project({ _id: 0 }).sort({ createdAt: -1 }).toArray() as CollectionRecord[]; } catch (error) { return toDatabaseError(error, 'DATABASE_ERROR'); } }
  async updateBookIds(id: string, userId: string, bookIds: string[]) { try { return await this.records.findOneAndUpdate({ id, userId }, { $set: { bookIds } }, { returnDocument: 'after', projection: { _id: 0 } }) as CollectionRecord | null; } catch (error) { return toDatabaseError(error, 'DATABASE_ERROR'); } }
  async delete(id: string, userId: string) { try { return (await this.records.deleteOne({ id, userId })).deletedCount === 1; } catch (error) { return toDatabaseError(error, 'DATABASE_ERROR'); } }
}
export class MongoReviewRepository implements ReviewRepository {
  private readonly records: Collection<ReviewRecord>; private readonly likes: Collection<ReviewLikeRecord>; private readonly comments: Collection<ReviewCommentRecord>;
  constructor(db: Db) { this.records = db.collection('reviews'); this.likes = db.collection('review_likes'); this.comments = db.collection('review_comments'); }
  async create(record: ReviewRecord) { try { await this.records.insertOne(record); return record; } catch (error) { return toDatabaseError(error, 'DUPLICATE_REVIEW'); } }
  async findById(id: string) { try { return await this.records.findOne({ id }, { projection: { _id: 0 } }) as ReviewRecord | null; } catch (error) { return toDatabaseError(error, 'DATABASE_ERROR'); } }
  async listByBook(bookId: string) { try { return await this.records.find({ bookId }).project({ _id: 0 }).sort({ createdAt: -1 }).toArray() as ReviewRecord[]; } catch (error) { return toDatabaseError(error, 'DATABASE_ERROR'); } }
  async listFeed(limit: number) { try { return await this.records.find({}).project({ _id: 0 }).sort({ createdAt: -1 }).limit(limit).toArray() as ReviewRecord[]; } catch (error) { return toDatabaseError(error, 'DATABASE_ERROR'); } }
  async setLike(reviewId: string, userId: string, liked: boolean) {
    try {
      const review = await this.findById(reviewId); if (!review) throw new Error('REVIEW_NOT_FOUND');
      if (liked) {
        try { await this.likes.insertOne({ id: `review-like-${reviewId}-${userId}`, reviewId, userId, createdAt: new Date().toISOString() }); await this.records.updateOne({ id: reviewId }, { $inc: { likes: 1 } }); } catch (error) { if ((error as { code?: number })?.code !== 11000) throw error; }
      } else {
        const removed = await this.likes.deleteOne({ reviewId, userId }); if (removed.deletedCount) await this.records.updateOne({ id: reviewId, likes: { $gt: 0 } }, { $inc: { likes: -1 } });
      }
      const current = await this.findById(reviewId); const relation = await this.likes.findOne({ reviewId, userId }, { projection: { _id: 0 } });
      return { likes: current?.likes || 0, liked: !!relation };
    } catch (error) { return toDatabaseError(error, 'DATABASE_ERROR'); }
  }
  async isLiked(reviewId: string, userId: string) { try { return !!await this.likes.findOne({ reviewId, userId }, { projection: { _id: 1 } }); } catch (error) { return toDatabaseError(error, 'DATABASE_ERROR'); } }
  async createComment(record: ReviewCommentRecord) {
    try { if (!await this.findById(record.reviewId)) throw new Error('REVIEW_NOT_FOUND'); await this.comments.insertOne(record); await this.records.updateOne({ id: record.reviewId }, { $inc: { commentsCount: 1 } }); return record; } catch (error) { return toDatabaseError(error, 'DUPLICATE_REVIEW_COMMENT'); }
  }
  async listComments(reviewId: string) { try { return await this.comments.find({ reviewId }).project({ _id: 0 }).sort({ createdAt: 1 }).toArray() as ReviewCommentRecord[]; } catch (error) { return toDatabaseError(error, 'DATABASE_ERROR'); } }
}
export class MongoRightsRepository implements RightsRepository {
  private readonly records: Collection<RightsRecord>; constructor(db: Db) { this.records = db.collection('rights_records'); }
  async create(record: RightsRecord) { try { await this.records.insertOne(record); return record; } catch (error) { return toDatabaseError(error, 'DUPLICATE_RIGHTS'); } }
  async listByBook(bookId: string) { try { return await this.records.find({ bookId }).project({ _id: 0 }).sort({ createdAt: -1 }).toArray() as RightsRecord[]; } catch (error) { return toDatabaseError(error, 'DATABASE_ERROR'); } }
}
export class MongoAuditLogRepository implements AuditLogRepository {
  private readonly records: Collection<AuditLogRecord>; constructor(db: Db) { this.records = db.collection('audit_logs'); }
  async append(record: AuditLogRecord) { try { await this.records.insertOne(record); return record; } catch (error) { return toDatabaseError(error, 'DUPLICATE_AUDIT'); } }
  async list(entityType?: string, entityId?: string) { try { return await this.records.find({ ...(entityType ? { entityType: entityType as AuditLogRecord['entityType'] } : {}), ...(entityId ? { entityId } : {}) }).project({ _id: 0 }).sort({ timestamp: -1 }).toArray() as AuditLogRecord[]; } catch (error) { return toDatabaseError(error, 'DATABASE_ERROR'); } }
}
