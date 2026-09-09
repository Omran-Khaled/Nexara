import { randomUUID } from 'node:crypto';
import { Book } from '../../src/types';
import { NotFoundError, ValidationError } from '../errors/ApplicationErrors';
import { DownloadRecord, UserBookStateRecord, UserNotificationRecord, UserTimeCapsuleRecord } from '../models/runtime';
import { BookRepository } from '../repositories/BookRepository';
import { RuntimeRepository } from '../repositories/RuntimeRepositories';
import { nowIso } from '../utils/semantics';

export type ShelfState = 'SAVED' | 'CURRENTLY_READING' | 'WANT_TO_READ' | 'FINISHED' | 'NONE';

function validShelf(value: unknown): value is ShelfState { return value === 'SAVED' || value === 'CURRENTLY_READING' || value === 'WANT_TO_READ' || value === 'FINISHED' || value === 'NONE'; }
function validFormat(value: unknown): value is DownloadRecord['format'] { return value === 'PDF' || value === 'EPUB' || value === 'TXT' || value === 'HTML'; }

export class RuntimeService {
  constructor(private readonly runtime: RuntimeRepository, private readonly books: BookRepository) {}

  listAuthors() { return this.runtime.listAuthors(); }
  listReadingPaths() { return this.runtime.listReadingPaths(); }

  async listPersonal(userId: string) {
    const [bookStates, downloads, achievements, notifications, timeCapsules] = await Promise.all([
      this.runtime.listUserBookStates(userId),
      this.runtime.listDownloads(userId),
      this.runtime.listAchievements(userId),
      this.runtime.listNotifications(userId),
      this.runtime.listTimeCapsules(userId),
    ]);
    return { bookStates, downloads, achievements, notifications, timeCapsules };
  }

  async upsertBookState(userId: string, input: unknown): Promise<UserBookStateRecord> {
    const data = input as Record<string, unknown>;
    const bookId = typeof data.bookId === 'string' ? data.bookId.trim() : '';
    if (!bookId) throw new ValidationError({ bookId: 'is required.' });
    if (!validShelf(data.shelf)) throw new ValidationError({ shelf: 'must be a supported shelf state.' });
    if (typeof data.saved !== 'boolean' || typeof data.favourite !== 'boolean') throw new ValidationError({ saved: 'must be boolean.', favourite: 'must be boolean.' });
    const book = await this.books.findById(bookId);
    if (!book) throw new NotFoundError('Book', bookId);
    return this.runtime.upsertUserBookState({ id: `book-state-${userId}-${bookId}`, userId, bookId, saved: data.saved, favourite: data.favourite, shelf: data.shelf, updatedAt: nowIso() });
  }

  async createTimeCapsule(userId: string, input: unknown): Promise<UserTimeCapsuleRecord> {
    const data = input as Record<string, unknown>;
    const bookId = typeof data.bookId === 'string' ? data.bookId.trim() : '';
    const unlockDate = typeof data.unlockDate === 'string' ? data.unlockDate : '';
    const personalNote = typeof data.personalNote === 'string' ? data.personalNote.trim() : '';
    if (!bookId || !unlockDate || !personalNote) throw new ValidationError({ bookId: 'is required.', unlockDate: 'is required.', personalNote: 'is required.' });
    if (personalNote.length > 5_000) throw new ValidationError({ personalNote: 'must not exceed 5000 characters.' });
    const book = await this.books.findById(bookId);
    if (!book) throw new NotFoundError('Book', bookId);
    const createdAt = nowIso();
    return this.runtime.createTimeCapsule({ id: `time-capsule-${randomUUID()}`, userId, bookId, bookTitle: book.title, coverImage: book.coverImage, unlockDate, personalNote, isUnlocked: new Date(unlockDate).getTime() <= Date.now(), createdAt });
  }

  async markNotificationRead(userId: string, id: string): Promise<UserNotificationRecord> {
    const record = await this.runtime.markNotificationRead(userId, id);
    if (!record) throw new NotFoundError('Notification', id);
    return record;
  }

  async recordDownload(userId: string, input: unknown): Promise<DownloadRecord> {
    const data = input as Record<string, unknown>;
    const bookId = typeof data.bookId === 'string' ? data.bookId.trim() : '';
    const editionId = typeof data.editionId === 'string' ? data.editionId.trim() : '';
    if (!bookId || !editionId || !validFormat(data.format)) throw new ValidationError({ bookId: 'is required.', editionId: 'is required.', format: 'must be PDF, EPUB, TXT, or HTML.' });
    const book: Book | null = await this.books.findById(bookId);
    if (!book || !book.editions.some((edition) => edition.id === editionId)) throw new NotFoundError('Book or edition', `${bookId}/${editionId}`);
    throw new ValidationError({ download: 'Downloads must be recorded only by the server-authorized content delivery flow.' });
  }
}
