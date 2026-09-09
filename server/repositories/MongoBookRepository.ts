import { Collection, Db } from 'mongodb';
import { Book } from '../../src/types';
import { AuthorDocument, BookFileDocument, WorkDocument } from '../models/catalog';
import { BookDocument, toBookApi } from '../models/book';
import { BookFileRecord } from '../storage/BookFileRepository';
import { BookRepository, BookSearchQuery, PageResult } from './BookRepository';
import { DatabaseError } from '../errors/ApplicationErrors';
import { PageRequest } from '../utils/http';
import { MongoCatalogRepository } from './CatalogRepository';

/** Catalogue read repository backed by the `books` projection. Mutations delegate to
 * MongoCatalogRepository, which keeps projection and normalized collections coherent. */
export class MongoBookRepository implements BookRepository {
  private readonly collection: Collection<BookDocument>;
  private readonly catalog: MongoCatalogRepository;

  constructor(private readonly db: Db) {
    this.collection = db.collection<BookDocument>('books');
    this.catalog = new MongoCatalogRepository(db);
  }

  async findById(id: string): Promise<Book | null> {
    try {
      const document = await this.collection.findOne({ id }, { projection: { _id: 0 } });
      return document ? this.attachFiles(toBookApi(document)) : null;
    } catch (error) { throw new DatabaseError('Could not read book.', error); }
  }

  async search(query: BookSearchQuery, page: PageRequest): Promise<PageResult<Book>> {
    const filter: Record<string, unknown> = {};
    if (query.contentAvailability) filter.contentAvailability = query.contentAvailability;
    if (query.workflowStatus) filter.workflowStatus = query.workflowStatus;
    const textQuery = query.query?.trim();
    if (textQuery) filter.$text = { $search: textQuery };
    try {
      const projection = textQuery ? { _id: 0, score: { $meta: 'textScore' } } : { _id: 0 };
      const cursor = this.collection.find(filter, { projection, maxTimeMS: 1_500 })
        .sort(textQuery ? { score: { $meta: 'textScore' }, updatedAt: -1 } : { updatedAt: -1 })
        .skip((page.page - 1) * page.limit).limit(page.limit);
      const [data, total] = await Promise.all([
        cursor.toArray() as Promise<Book[]>,
        this.collection.countDocuments(filter, { maxTimeMS: 1_500 }),
      ]);
      return { data: await Promise.all(data.map((book) => this.attachFiles(toBookApi(book)))), total, page: page.page, limit: page.limit };
    } catch (error) {
      const timedOut = (error as { code?: number; codeName?: string })?.code === 50 || (error as { codeName?: string })?.codeName === 'MaxTimeMSExpired';
      throw new DatabaseError(timedOut ? 'Book search exceeded its MongoDB time budget.' : 'Could not search books.', error);
    }
  }

  private async attachFiles(book: Book): Promise<Book> {
    const files = await this.db.collection<BookFileDocument>('book_files')
      .find({ bookId: book.id }, { projection: { _id: 0 } })
      .toArray();
    const fileByEdition = new Map<string, BookFileDocument[]>();
    for (const file of files) fileByEdition.set(file.editionId, [...(fileByEdition.get(file.editionId) || []), file]);
    return {
      ...book,
      editions: book.editions.map((edition) => ({
        ...edition,
        files: fileByEdition.get(edition.id)?.map((file) => ({
          ...file,
          sizeFormatted: `${Math.max(1, Math.round(file.sizeBytes / 1024))} KB`,
        })) || [],
      })),
    };
  }

  async create(book: Book): Promise<Book> {
    try {
      await this.ensureReferences(book);
      return await this.catalog.createBookAggregate(book);
    }
    catch (error: any) {
      if (error?.code === 11000 || error?.message === 'DUPLICATE_KEY') throw new Error('DUPLICATE_KEY');
      throw error;
    }
  }

  private async ensureReferences(book: Book): Promise<void> {
    const authors = this.db.collection<AuthorDocument>('authors');
    const works = this.db.collection<WorkDocument>('works');
    const timestamp = new Date().toISOString();
    const existingAuthor = await authors.findOne({ id: book.authorId }, { projection: { _id: 0, id: 1 } });
    if (!existingAuthor) {
      const author: AuthorDocument = {
        id: book.authorId,
        name: book.authorName,
        nameAr: book.authorNameAr || book.authorName,
        slug: book.authorId,
        avatar: '',
        birthYear: 0,
        era: 'Unknown',
        eraAr: 'غير محدد',
        country: 'Unknown',
        countryAr: 'غير محدد',
        bio: 'Author added with a Nexara library upload.',
        bioAr: 'مؤلف أُضيف مع رفع كتاب إلى مكتبة Nexara.',
        timeline: [],
        languages: [book.primaryLanguage],
        relatedAuthorIds: [],
        followersCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await authors.insertOne(author);
    }
    const existingWork = await works.findOne({ id: book.workId }, { projection: { _id: 0, id: 1 } });
    if (!existingWork) {
      const work: WorkDocument = {
        id: book.workId,
        authorId: book.authorId,
        slug: book.slug,
        title: book.title,
        titleAr: book.titleAr || book.title,
        originalTitle: book.originalTitle,
        description: book.description,
        descriptionAr: book.descriptionAr || book.description,
        primaryLanguage: book.primaryLanguage,
        publicationYear: book.publicationYear,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await works.insertOne(work);
    }
  }

  async update(id: string, patch: Partial<Book>, expectedUpdatedAt?: string): Promise<Book | null> {
    const current = await this.findById(id);
    if (!current) return null;
    if (expectedUpdatedAt && current.updatedAt !== expectedUpdatedAt) throw new Error('STALE_UPDATE');
    const next = { ...current, ...patch, id, createdAt: current.createdAt, updatedAt: new Date().toISOString() } as Book;
    try { return await this.catalog.replaceBookAggregate(next); }
    catch (error: any) {
      if (error?.code === 11000 || error?.message === 'DUPLICATE_KEY') throw new Error('DUPLICATE_KEY');
      throw error;
    }
  }

  async publishUploadedFile(bookId: string, editionId: string, file: BookFileRecord): Promise<void> {
    const current = await this.collection.findOne({ id: bookId }, { projection: { _id: 0 } });
    if (!current) throw new Error(`Book '${bookId}' was not found.`);
    const edition = current.editions.find((item) => item.id === editionId);
    if (!edition) throw new Error(`Edition '${editionId}' was not found.`);
    const fileRef = {
      ...file,
      sizeFormatted: `${Math.max(1, Math.round(file.sizeBytes / 1024))} KB`,
    };
    await this.collection.updateOne(
      { id: bookId },
      {
        $set: {
          contentAvailability: 'FULL_TEXT',
          workflowStatus: 'PUBLISHED',
          updatedAt: new Date().toISOString(),
          [`editions.${current.editions.indexOf(edition)}.files`]: [fileRef],
        },
      },
    );
  }

  async delete(id: string): Promise<boolean> {
    try { return await this.catalog.deleteBookAggregate(id); }
    catch (error) { throw new DatabaseError('Could not delete book.', error); }
  }
}
