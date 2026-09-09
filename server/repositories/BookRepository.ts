import { Book } from '../../src/types';
import { BookFileRecord } from '../storage/BookFileRepository';
import { PageRequest } from '../utils/http';

export interface BookSearchQuery {
  query?: string;
  contentAvailability?: Book['contentAvailability'];
  workflowStatus?: Book['workflowStatus'];
}

export interface PageResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface BookRepository {
  findById(id: string): Promise<Book | null>;
  search(query: BookSearchQuery, page: PageRequest): Promise<PageResult<Book>>;
  create(book: Book): Promise<Book>;
  update(id: string, patch: Partial<Book>, expectedUpdatedAt?: string): Promise<Book | null>;
  delete(id: string): Promise<boolean>;
  publishUploadedFile?(bookId: string, editionId: string, file: BookFileRecord): Promise<void>;
}

function isbns(book: Book): string[] {
  return book.editions.flatMap((edition) => edition.isbn ? [edition.isbn] : []);
}

export class InMemoryBookRepository implements BookRepository {
  private readonly records = new Map<string, Book>();

  constructor(seed: Book[] = []) {
    for (const book of seed) this.records.set(book.id, structuredClone(book));
  }

  async findById(id: string): Promise<Book | null> {
    const book = this.records.get(id);
    return book ? structuredClone(book) : null;
  }

  async search(query: BookSearchQuery, page: PageRequest): Promise<PageResult<Book>> {
    const normalized = query.query?.toLowerCase().trim();
    const all = [...this.records.values()].filter((book) => {
      const matchesText = !normalized || [book.title, book.titleAr, book.authorName, book.authorNameAr].some((value) => value.toLowerCase().includes(normalized));
      return matchesText && (!query.contentAvailability || book.contentAvailability === query.contentAvailability) && (!query.workflowStatus || book.workflowStatus === query.workflowStatus);
    });
    const start = (page.page - 1) * page.limit;
    return { data: structuredClone(all.slice(start, start + page.limit)), total: all.length, page: page.page, limit: page.limit };
  }

  async create(book: Book): Promise<Book> {
    if (this.records.has(book.id)) throw new Error('DUPLICATE_ID');
    if ([...this.records.values()].some((record) => record.slug === book.slug)) throw new Error('DUPLICATE_SLUG');
    if (isbns(book).some((isbn) => [...this.records.values()].some((record) => isbns(record).includes(isbn)))) throw new Error('DUPLICATE_ISBN');
    this.records.set(book.id, structuredClone(book));
    return structuredClone(book);
  }

  async update(id: string, patch: Partial<Book>, expectedUpdatedAt?: string): Promise<Book | null> {
    const current = this.records.get(id);
    if (!current) return null;
    if (expectedUpdatedAt && current.updatedAt !== expectedUpdatedAt) throw new Error('STALE_UPDATE');
    const next = { ...current, ...structuredClone(patch), id };
    if ([...this.records.values()].some((record) => record.id !== id && record.slug === next.slug)) throw new Error('DUPLICATE_SLUG');
    if (isbns(next).some((isbn) => [...this.records.values()].some((record) => record.id !== id && isbns(record).includes(isbn)))) throw new Error('DUPLICATE_ISBN');
    this.records.set(id, next);
    return structuredClone(next);
  }

  async delete(id: string): Promise<boolean> {
    return this.records.delete(id);
  }
}
