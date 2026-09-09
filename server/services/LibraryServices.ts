import { randomUUID } from 'node:crypto';
import { Book } from '../../src/types';
import { ConflictError, NotFoundError, ValidationError } from '../errors/ApplicationErrors';
import { AuditLogRecord, BookmarkRecord, CollectionRecord, HighlightRecord, ReadingHistoryRecord, ReadingProgressRecord, ReviewCommentRecord, ReviewRecord, RightsRecord } from '../models/library';
import { AuditLogRepository, BookmarkRepository, CollectionRepository, HighlightRepository, InMemoryReadingHistoryRepository, ReadingHistoryRepository, ReadingProgressRepository, ReviewRepository, RightsRepository } from '../repositories/LibraryRepositories';
import { BookRepository } from '../repositories/BookRepository';
import { nowIso } from '../utils/semantics';
import { BookmarkInput, CollectionInput, HighlightInput, ProgressInput, ReviewCommentInput, ReviewInput, RightsInput } from '../validators/libraryValidators';
import { resolveDirectUploadRights } from '../rights/directUploadRights';

function now() { return nowIso(); }
function readable(book: Book) { return book.contentAvailability === 'FULL_TEXT' || book.contentAvailability === 'PREVIEW'; }
function duplicate(error: unknown, message: string): never { if (String((error as Error)?.message).startsWith('DUPLICATE')) throw new ConflictError(message); throw error; }

export class AuditService {
  constructor(private readonly repository: AuditLogRepository) {}

  async record(action: string, entityType: AuditLogRecord['entityType'], entityId: string, performedBy: string, details: string, options: { status?: AuditLogRecord['status']; changeSummary?: string; before?: unknown; after?: unknown; requestId?: string; idempotencyKey?: string; source?: string } = {}) {
    const record: AuditLogRecord = {
      id: `audit-${randomUUID()}`,
      action,
      entityType,
      entityId,
      resource: entityType.toLowerCase(),
      resourceId: entityId,
      performedBy,
      timestamp: now(),
      status: options.status || 'SUCCESS',
      details,
      changeSummary: options.changeSummary || details,
      context: { requestId: options.requestId, idempotencyKey: options.idempotencyKey, source: options.source || 'server' },
      before: options.before,
      after: options.after,
    };
    return this.repository.append(record);
  }

  async execute<T>(action: string, entityType: AuditLogRecord['entityType'], entityId: string, performedBy: string, details: string, operation: () => Promise<T>, options: { before?: unknown; idempotencyKey?: string; requestId?: string } = {}): Promise<T> {
    const pending = await this.record(action, entityType, entityId, performedBy, details, { status: 'PENDING', before: options.before, idempotencyKey: options.idempotencyKey, requestId: options.requestId, changeSummary: `Pending mutation: ${details}` });
    try {
      const result = await operation();
      await this.record(`${action}_COMPLETED`, entityType, entityId, performedBy, details, { status: 'SUCCESS', before: options.before, after: result, idempotencyKey: options.idempotencyKey, requestId: options.requestId, changeSummary: `Completed mutation; outbox ${pending.id} reconciled.` });
      return result;
    } catch (error) {
      try {
        await this.record(`${action}_FAILED`, entityType, entityId, performedBy, details, { status: 'FAILED', before: options.before, idempotencyKey: options.idempotencyKey, requestId: options.requestId, changeSummary: `Mutation failed; outbox ${pending.id} retained for reconciliation.` });
      } catch {
        // The durable PENDING record remains as the reconciliation source of truth.
      }
      throw error;
    }
  }

  list(entityType?: string, entityId?: string) { return this.repository.list(entityType, entityId); }
}

abstract class BookReferenceService {
  constructor(protected readonly books: BookRepository) {}
  protected async getBook(id: string) { const book = await this.books.findById(id); if (!book) throw new NotFoundError('Book', id); return book; }
  protected requireEdition(book: Book, editionId: string) { if (!book.editions.some((edition) => edition.id === editionId)) throw new ValidationError({ editionId: `does not belong to book '${book.id}'.` }); }
  protected requireChapter(book: Book, index: number) { if (!readable(book)) throw new ConflictError('This book has no readable content.'); if (index < 0 || index >= book.chapters.length) throw new ValidationError({ chapterIndex: 'does not reference an available chapter.' }); }
}

export class ReadingService extends BookReferenceService {
  private readonly history: ReadingHistoryRepository;
  constructor(books: BookRepository, private readonly repository: ReadingProgressRepository, private readonly audit: AuditService, history?: ReadingHistoryRepository) { super(books); this.history = history || new InMemoryReadingHistoryRepository(); }
  async upsert(bookId: string, input: ProgressInput) {
    const book = await this.getBook(bookId); this.requireEdition(book, input.editionId); this.requireChapter(book, input.currentChapterIndex);
    const record: ReadingProgressRecord = { id: `progress-${input.userId}-${bookId}-${input.editionId}`, userId: input.userId, bookId, editionId: input.editionId, currentChapterIndex: input.currentChapterIndex, currentScrollPercent: input.currentScrollPercent, completedPercent: input.completedPercent, lastReadAt: now(), totalSecondsSpent: input.totalSecondsSpent, completed: input.completedPercent >= 100, clientSequence: input.clientSequence, clientUpdatedAt: input.clientUpdatedAt };
    const saved = await this.audit.execute('READING_PROGRESS_UPSERTED', 'BOOK', bookId, input.userId, `Progress saved at chapter ${input.currentChapterIndex}.`, () => this.repository.upsert(record), { idempotencyKey: `${record.id}:${input.clientSequence}` });
    await this.history.record({ id: `history-${input.userId}-${bookId}-${input.editionId}-${saved.clientSequence}`, userId: input.userId, bookId, editionId: input.editionId, event: saved.completed ? 'COMPLETED' : 'PROGRESS_SAVED', occurredAt: saved.lastReadAt });
    return saved;
  }
  async recordOpened(bookId: string, userId: string, editionId: string) {
    const book = await this.getBook(bookId); this.requireEdition(book, editionId);
    const record: ReadingHistoryRecord = { id: `history-${randomUUID()}`, userId, bookId, editionId, event: 'OPENED', occurredAt: now() };
    return this.audit.execute('READING_SESSION_OPENED', 'BOOK', bookId, userId, 'Reading session opened.', () => this.history.record(record));
  }
  list(userId: string, bookId?: string) { return this.repository.list(userId, bookId); }
  listHistory(userId: string, limit?: number) { return this.history.list(userId, limit); }
}

export class BookmarkService extends BookReferenceService {
  constructor(books: BookRepository, private readonly repository: BookmarkRepository, private readonly audit: AuditService) { super(books); }
  async create(input: BookmarkInput) {
    const book = await this.getBook(input.bookId); this.requireEdition(book, input.editionId); this.requireChapter(book, input.chapterIndex);
    const record: BookmarkRecord = { id: `bookmark-${randomUUID()}`, ...input, createdAt: now() };
    return this.audit.execute('BOOKMARK_CREATED', 'BOOKMARK', record.id, input.userId, `Bookmark created for ${input.bookId}.`, async () => { try { return await this.repository.create(record); } catch (error) { return duplicate(error, 'A bookmark already exists for this reading position.'); } }, { idempotencyKey: `${input.userId}:${input.bookId}:${input.editionId}:${input.chapterIndex}` });
  }
  list(userId: string, bookId?: string) { return this.repository.list(userId, bookId); }
  async delete(id: string, userId: string) { return this.audit.execute('BOOKMARK_DELETED', 'BOOKMARK', id, userId, 'Bookmark removed.', async () => { if (!(await this.repository.delete(id, userId))) throw new NotFoundError('Bookmark', id); }); }
}

export class HighlightService extends BookReferenceService {
  constructor(books: BookRepository, private readonly repository: HighlightRepository, private readonly audit: AuditService) { super(books); }
  async create(input: HighlightInput) {
    const book = await this.getBook(input.bookId); this.requireChapter(book, input.chapterIndex);
    const record: HighlightRecord = { id: `highlight-${randomUUID()}`, userId: input.userId, bookId: input.bookId, bookTitle: book.title, authorName: book.authorName, chapterIndex: input.chapterIndex, chapterTitle: book.chapters[input.chapterIndex].title, selectedText: input.selectedText, color: input.color, note: input.note, createdAt: now() };
    return this.audit.execute('HIGHLIGHT_CREATED', 'HIGHLIGHT', record.id, input.userId, `Highlight created for ${input.bookId}.`, async () => { try { return await this.repository.create(record); } catch (error) { return duplicate(error, 'A duplicate highlight could not be created.'); } });
  }
  list(userId: string, bookId?: string) { return this.repository.list(userId, bookId); }
  async updateNote(id: string, userId: string, note: string) { return this.audit.execute('HIGHLIGHT_NOTE_UPDATED', 'HIGHLIGHT', id, userId, 'Highlight note updated.', async () => { const updated = await this.repository.updateNote(id, userId, note); if (!updated) throw new NotFoundError('Highlight', id); return updated; }); }
  async delete(id: string, userId: string) { return this.audit.execute('HIGHLIGHT_DELETED', 'HIGHLIGHT', id, userId, 'Highlight removed.', async () => { if (!(await this.repository.delete(id, userId))) throw new NotFoundError('Highlight', id); }); }
}

export class CollectionService extends BookReferenceService {
  constructor(books: BookRepository, private readonly repository: CollectionRepository, private readonly audit: AuditService) { super(books); }
  async create(input: CollectionInput) {
    for (const bookId of input.bookIds) await this.getBook(bookId);
    const record: CollectionRecord = { id: `collection-${randomUUID()}`, ...input, createdAt: now() };
    return this.audit.execute('COLLECTION_CREATED', 'COLLECTION', record.id, input.userId, `Collection created with ${input.bookIds.length} books.`, async () => { try { return await this.repository.create(record); } catch (error) { return duplicate(error, 'A collection with this title already exists for this user.'); } }, { idempotencyKey: `${input.userId}:${input.title.trim().toLocaleLowerCase()}` });
  }
  list(userId: string) { return this.repository.list(userId); }
  async updateBookIds(id: string, userId: string, bookIds: string[]) {
    for (const bookId of bookIds) await this.getBook(bookId);
    const uniqueBookIds = Array.from(new Set(bookIds));
    return this.audit.execute('COLLECTION_BOOKS_UPDATED', 'COLLECTION', id, userId, `Collection membership updated with ${uniqueBookIds.length} books.`, async () => {
      const updated = await this.repository.updateBookIds(id, userId, uniqueBookIds); if (!updated) throw new NotFoundError('Collection', id); return updated;
    });
  }
  async delete(id: string, userId: string) { return this.audit.execute('COLLECTION_DELETED', 'COLLECTION', id, userId, 'Collection removed.', async () => { if (!(await this.repository.delete(id, userId))) throw new NotFoundError('Collection', id); }); }
}

export class ReviewService extends BookReferenceService {
  constructor(books: BookRepository, private readonly repository: ReviewRepository, private readonly audit: AuditService) { super(books); }
  private async withViewer(records: ReviewRecord[], viewerId?: string) {
    return Promise.all(records.map(async (record) => ({ ...record, ...(viewerId ? { likedByCurrentUser: await this.repository.isLiked(record.id, viewerId) } : {}) })));
  }
  async create(input: ReviewInput) {
    await this.getBook(input.bookId);
    const record: ReviewRecord = { id: `review-${randomUUID()}`, ...input, createdAt: now(), likes: 0, commentsCount: 0, isVerifiedReader: false };
    return this.audit.execute('REVIEW_CREATED', 'REVIEW', record.id, input.userId, `Review created for ${input.bookId}.`, async () => { try { return await this.repository.create(record); } catch (error) { return duplicate(error, 'This user already has a review for this book.'); } }, { idempotencyKey: `${input.bookId}:${input.userId}` });
  }
  async listByBook(bookId: string, viewerId?: string) { await this.getBook(bookId); return this.withViewer(await this.repository.listByBook(bookId), viewerId); }
  async listFeed(viewerId?: string, limit = 50) { return this.withViewer(await this.repository.listFeed(limit), viewerId); }
  async setLike(reviewId: string, userId: string, liked: boolean) {
    if (!await this.repository.findById(reviewId)) throw new NotFoundError('Review', reviewId);
    const result = await this.audit.execute(liked ? 'REVIEW_LIKED' : 'REVIEW_UNLIKED', 'REVIEW', reviewId, userId, liked ? 'Review liked.' : 'Review like removed.', () => this.repository.setLike(reviewId, userId, liked));
    return result;
  }
  async createComment(reviewId: string, userId: string, userName: string, userAvatar: string, input: ReviewCommentInput) {
    if (!await this.repository.findById(reviewId)) throw new NotFoundError('Review', reviewId);
    const record: ReviewCommentRecord = { id: `review-comment-${randomUUID()}`, reviewId, userId, userName, userAvatar, content: input.content, createdAt: now() };
    return this.audit.execute('REVIEW_COMMENT_CREATED', 'REVIEW', reviewId, userId, 'Review discussion reply created.', () => this.repository.createComment(record));
  }
  async listComments(reviewId: string) { if (!await this.repository.findById(reviewId)) throw new NotFoundError('Review', reviewId); return this.repository.listComments(reviewId); }
}

export class RightsService extends BookReferenceService {
  constructor(books: BookRepository, private readonly repository: RightsRepository, private readonly audit: AuditService) { super(books); }
  async create(input: RightsInput, performedBy: string) {
    const book = await this.getBook(input.bookId);
    const edition = input.editionId ? book.editions.find((candidate) => candidate.id === input.editionId) : undefined;
    if (input.editionId && !edition) this.requireEdition(book, input.editionId);
    if (edition && edition.rightsStatus !== input.status) throw new ValidationError({ status: `must match the referenced edition rights status (${edition.rightsStatus}) until the edition is updated through the catalogue workflow.` });
    if (book.contentAvailability === 'FULL_TEXT' && (input.status === 'RESTRICTED' || input.status === 'UNAVAILABLE')) throw new ValidationError({ status: 'cannot be RESTRICTED or UNAVAILABLE while the book is marked FULL_TEXT.' });
    const timestamp = now(); const record: RightsRecord = { id: `rights-${randomUUID()}`, ...input, isCurrent: true, createdAt: timestamp, updatedAt: timestamp };
    return this.audit.execute('RIGHTS_RECORDED', 'RIGHTS', record.id, performedBy, `Rights record created for ${input.bookId}.`, async () => { try { return await this.repository.create(record); } catch (error) { return duplicate(error, 'A current rights record already exists for this book and edition.'); } }, { idempotencyKey: `${input.bookId}:${input.editionId || 'work'}:current` });
  }

  /**
   * Completes a direct-upload rights payload from the referenced edition when
   * the client omits derivable legal/audit fields, so the admin UI never has to
   * collect them manually. Explicit client values are preserved so the stricter
   * original contract remains fully supported.
   */
  async resolveForDirectUpload(bookId: string, editionId: string, raw: Record<string, unknown>) {
    const book = await this.getBook(bookId);
    const edition = book.editions.find((candidate) => candidate.id === editionId);
    if (!edition) this.requireEdition(book, editionId);
    return resolveDirectUploadRights(bookId, editionId, raw, edition);
  }

  listByBook(bookId: string) { return this.repository.listByBook(bookId); }
}
