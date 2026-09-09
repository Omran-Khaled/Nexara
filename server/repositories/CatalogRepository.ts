import { ClientSession, Collection, Db } from 'mongodb';
import { Author, Book, BookChapter, BookEdition, ContentAvailability } from '../../src/types';
import { AuthorDocument, BookFileDocument, CanonicalBookDocument, ChapterDocument, EditionDocument, WorkDocument } from '../models/catalog';
import { ConflictError, NotFoundError, ValidationError } from '../errors/ApplicationErrors';

const copy = <T>(value: T): T => structuredClone(value);

function now(): string { return new Date().toISOString(); }
function distinct(values: string[]): boolean { return new Set(values).size === values.length; }

/**
 * Canonical catalogue persistence. `books` is retained as a read projection; `works`,
 * `editions`, `book_files`, and `chapters` are the normalized source records. Every
 * aggregate write runs in a MongoDB transaction, so a failed component write cannot
 * leave orphaned edition, file, or chapter records behind.
 */
export class MongoCatalogRepository {
  private readonly authors: Collection<AuthorDocument>;
  private readonly works: Collection<WorkDocument>;
  private readonly books: Collection<CanonicalBookDocument>;
  private readonly editions: Collection<EditionDocument>;
  private readonly files: Collection<BookFileDocument>;
  private readonly chapters: Collection<ChapterDocument>;

  constructor(private readonly db: Db) {
    this.authors = db.collection<AuthorDocument>('authors');
    this.works = db.collection<WorkDocument>('works');
    this.books = db.collection<CanonicalBookDocument>('books');
    this.editions = db.collection<EditionDocument>('editions');
    this.files = db.collection<BookFileDocument>('book_files');
    this.chapters = db.collection<ChapterDocument>('chapters');
  }

  async createAuthor(author: Author): Promise<AuthorDocument> {
    const timestamp = now();
    const record: AuthorDocument = { ...copy(author), createdAt: timestamp, updatedAt: timestamp };
    try { await this.authors.insertOne(record); return copy(record); }
    catch (error: unknown) { if ((error as { code?: number }).code === 11000) throw new ConflictError('Author', author.slug); throw error; }
  }

  async createWork(work: Omit<WorkDocument, 'createdAt' | 'updatedAt'>): Promise<WorkDocument> {
    await this.requireAuthor(work.authorId);
    const timestamp = now();
    const record: WorkDocument = { ...copy(work), createdAt: timestamp, updatedAt: timestamp };
    try { await this.works.insertOne(record); return copy(record); }
    catch (error: unknown) { if ((error as { code?: number }).code === 11000) throw new ConflictError('Work', work.slug); throw error; }
  }

  async upsertAuthor(author: Author): Promise<AuthorDocument> {
    const existing = await this.authors.findOne({ id: author.id }, { projection: { _id: 0, createdAt: 1 } });
    const timestamp = now();
    const record: AuthorDocument = { ...copy(author), createdAt: existing?.createdAt || timestamp, updatedAt: timestamp };
    await this.authors.replaceOne({ id: author.id }, record, { upsert: true });
    return copy(record);
  }

  async upsertWork(work: Omit<WorkDocument, 'createdAt' | 'updatedAt'>): Promise<WorkDocument> {
    await this.requireAuthor(work.authorId);
    const existing = await this.works.findOne({ id: work.id }, { projection: { _id: 0, createdAt: 1 } });
    const timestamp = now();
    const record: WorkDocument = { ...copy(work), createdAt: existing?.createdAt || timestamp, updatedAt: timestamp };
    await this.works.replaceOne({ id: work.id }, record, { upsert: true });
    return copy(record);
  }

  async createBookAggregate(book: Book): Promise<Book> {
    await this.writeAggregate(book, 'create');
    return copy(book);
  }

  async replaceBookAggregate(book: Book): Promise<Book> {
    await this.writeAggregate(book, 'replace');
    return copy(book);
  }

  async upsertBookAggregate(book: Book): Promise<Book> {
    const exists = await this.books.findOne({ id: book.id }, { projection: { _id: 0, id: 1 } });
    await this.writeAggregate(book, exists ? 'replace' : 'create');
    return copy(book);
  }

  async deleteBookAggregate(bookId: string): Promise<boolean> {
    return this.withTransaction(async (session) => {
      const book = await this.books.findOne({ id: bookId }, { session, projection: { _id: 0, id: 1 } });
      if (!book) return false;
      await Promise.all([
        this.files.deleteMany({ bookId }, { session }),
        this.chapters.deleteMany({ bookId }, { session }),
        this.editions.deleteMany({ bookId }, { session }),
        this.db.collection('rights_records').deleteMany({ bookId }, { session }),
        this.db.collection('reading_progress').deleteMany({ bookId }, { session }),
        this.db.collection('reading_history').deleteMany({ bookId }, { session }),
        this.db.collection('bookmarks').deleteMany({ bookId }, { session }),
        this.db.collection('highlights').deleteMany({ bookId }, { session }),
        this.db.collection('reviews').deleteMany({ bookId }, { session }),
        this.db.collection('user_book_states').deleteMany({ bookId }, { session }),
        this.db.collection('time_capsules').deleteMany({ bookId }, { session }),
        this.db.collection('downloads').deleteMany({ bookId }, { session }),
        this.db.collection('download_logs').deleteMany({ bookId }, { session }),
        this.db.collection('collections').updateMany({ bookIds: bookId }, { $pull: { bookIds: bookId } } as Record<string, unknown>, { session }),
      ]);
      await this.books.deleteOne({ id: bookId }, { session });
      return true;
    });
  }

  async deleteWork(id: string): Promise<boolean> {
    const count = await this.books.countDocuments({ workId: id });
    if (count) throw new ConflictError('Work', `${id} is referenced by ${count} book(s)`);
    return (await this.works.deleteOne({ id })).deletedCount === 1;
  }

  async deleteAuthor(id: string): Promise<boolean> {
    const [bookCount, workCount] = await Promise.all([this.books.countDocuments({ authorId: id }), this.works.countDocuments({ authorId: id })]);
    if (bookCount || workCount) throw new ConflictError('Author', `${id} is still referenced by catalogue records`);
    return (await this.authors.deleteOne({ id })).deletedCount === 1;
  }

  private async writeAggregate(book: Book, mode: 'create' | 'replace'): Promise<void> {
    const normalized = this.normalizeAndValidate(book);
    // Fail deterministic reference violations before allocating a transaction session.
    await this.validateReferences(normalized.book);
    await this.withTransaction(async (session) => {
      await this.validateReferences(normalized.book, session);
      const existing = await this.books.findOne({ id: normalized.book.id }, { session, projection: { _id: 0, id: 1 } });
      if (mode === 'create' && existing) throw new ConflictError('Book', normalized.book.id);
      if (mode === 'replace' && !existing) throw new NotFoundError('Book', normalized.book.id);
      if (mode === 'create') await this.books.insertOne(normalized.book, { session });
      else await this.books.replaceOne({ id: normalized.book.id }, normalized.book, { session });

      await Promise.all([
        this.editions.deleteMany({ bookId: normalized.book.id }, { session }),
        this.chapters.deleteMany({ bookId: normalized.book.id }, { session }),
      ]);
      if (normalized.editions.length) await this.editions.insertMany(normalized.editions, { session });
      if (normalized.chapters.length) await this.chapters.insertMany(normalized.chapters, { session });
    });
  }

  private normalizeAndValidate(book: Book): { book: CanonicalBookDocument; editions: EditionDocument[]; files: BookFileDocument[]; chapters: ChapterDocument[] } {
    const aggregate = copy(book) as CanonicalBookDocument;
    // Binary files are owned exclusively by BookFileService/P4 storage. Catalogue writes must never manufacture or replace them.
    if (!aggregate.id || !aggregate.slug || !aggregate.workId || !aggregate.authorId) throw new ValidationError({ book: 'id, slug, workId, and authorId are required.' });
    if (!aggregate.editions.length) throw new ValidationError({ editions: 'At least one edition is required.' });
    if (!distinct(aggregate.editions.map((edition) => edition.id))) throw new ValidationError({ editions: 'Edition ids must be unique within a book.' });
    if (!distinct(aggregate.chapters.map((chapter) => chapter.id))) throw new ValidationError({ chapters: 'Chapter ids must be unique within a book.' });
    if (!distinct(aggregate.editions.flatMap((edition) => edition.isbn ? [edition.isbn] : []))) throw new ValidationError({ editions: 'An ISBN may appear only once within a book.' });
    this.assertContentState(aggregate.contentAvailability, aggregate.editions, aggregate.chapters);

    const timestamp = now();
    aggregate.updatedAt = timestamp;
    if (!aggregate.createdAt) aggregate.createdAt = timestamp;
    // Keep catalogue metadata truthful: a file becomes visible only after BookFileService has stored and verified real bytes.
    aggregate.editions = aggregate.editions.map((edition) => ({ ...edition, files: [] }));
    const editions: EditionDocument[] = aggregate.editions.map(({ files: _files, ...edition }) => ({ ...edition, bookId: aggregate.id, workId: aggregate.workId, authorId: aggregate.authorId, createdAt: aggregate.createdAt, updatedAt: timestamp }));
    const files: BookFileDocument[] = [];
    const chapterEditionId = aggregate.editions[0].id;
    const chapters: ChapterDocument[] = aggregate.chapters.map((chapter, index) => ({ ...chapter, bookId: aggregate.id, editionId: chapterEditionId, sequence: index + 1, createdAt: aggregate.createdAt, updatedAt: timestamp }));
    return { book: aggregate, editions, files, chapters };
  }

  private assertContentState(availability: ContentAvailability, editions: BookEdition[], chapters: BookChapter[]): void {
    const readableFiles = editions.flatMap((edition) => edition.files).filter((file) => file.readingAllowed);
    if (availability === 'FULL_TEXT' && !chapters.length && !readableFiles.length) throw new ValidationError({ contentAvailability: 'FULL_TEXT requires supplied chapters or a verified readable file.' });
    if ((availability === 'METADATA_ONLY' || availability === 'UNAVAILABLE') && (chapters.length || readableFiles.length)) throw new ValidationError({ contentAvailability: `${availability} cannot contain readable chapters or files.` });
  }

  private async validateReferences(book: CanonicalBookDocument, session?: ClientSession): Promise<void> {
    const options = { ...(session ? { session } : {}) };
    // Session-scoped reads are intentionally sequential: MongoDB drivers do not permit
    // concurrent operations on one transaction session.
    const author = await this.authors.findOne({ id: book.authorId }, { ...options, projection: { _id: 0, id: 1 } });
    if (!author) throw new NotFoundError('Author', book.authorId);
    const work = await this.works.findOne({ id: book.workId }, { ...options, projection: { _id: 0, id: 1, authorId: 1 } });
    if (!work) throw new NotFoundError('Work', book.workId);
    if (work.authorId !== book.authorId) throw new ValidationError({ workId: 'The work author must match the book author.' });
  }

  private async requireAuthor(id: string): Promise<void> {
    if (!await this.authors.findOne({ id }, { projection: { _id: 0, id: 1 } })) throw new NotFoundError('Author', id);
  }

  private async withTransaction<T>(operation: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = this.db.client.startSession();
    try {
      let value!: T;
      await session.withTransaction(async () => { value = await operation(session); });
      return value;
    } finally { await session.endSession(); }
  }
}
