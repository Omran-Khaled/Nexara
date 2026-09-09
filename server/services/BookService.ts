import { Book, BookChapter } from '../../src/types';
import { ConflictError, NotFoundError } from '../errors/ApplicationErrors';
import { BookRepository, BookSearchQuery, PageResult } from '../repositories/BookRepository';
import { PageRequest } from '../utils/http';
import { validateBookWrite } from '../validators/bookValidators';
import { BookFileRecord } from '../storage/BookFileRepository';

export class BookService {
  constructor(private readonly repository: BookRepository) {}

  async list(query: BookSearchQuery, page: PageRequest): Promise<PageResult<Book>> {
    const result = await this.repository.search(query, page);
    return { ...result, data: result.data.map((book) => {
      if (book.chapters.length <= 20) return book;
      return { ...book, chapterCount: book.chapters.length, chapters: book.chapters.map(({ content: _content, contentAr: _contentAr, ...stub }) => ({ ...stub, content: '', contentAr: '' })) };
    }) };
  }

  async get(id: string): Promise<Book> {
    const book = await this.repository.findById(id);
    if (!book) throw new NotFoundError('Book', id);
    return book;
  }

  async getChapter(id: string, index: number): Promise<BookChapter> {
    const book = await this.get(id);
    if (!Number.isInteger(index) || index < 0 || index >= book.chapters.length) throw new NotFoundError('Chapter', `${id}:${index}`);
    return book.chapters[index];
  }

  async create(input: Book): Promise<Book> {
    try {
      const timestamp = new Date().toISOString();
      return await this.repository.create({ ...input, createdAt: timestamp, updatedAt: timestamp });
    } catch (error: any) {
      if (String(error?.message).startsWith('DUPLICATE')) throw new ConflictError('A book with the same id or slug already exists.');
      throw error;
    }
  }

  async update(id: string, patch: Partial<Book> & { expectedUpdatedAt?: string }): Promise<Book> {
    if (patch.contentAvailability === 'METADATA_ONLY' && patch.chapters && patch.chapters.length > 0) {
      throw new ConflictError('Metadata-only books cannot contain readable chapters.');
    }
    const { expectedUpdatedAt, ...mutablePatch } = patch;
    try {
      const current = await this.repository.findById(id);
      if (!current) throw new NotFoundError('Book', id);
      const updatedAt = new Date().toISOString();
      validateBookWrite({ ...current, ...mutablePatch, updatedAt });
      const book = await this.repository.update(id, { ...mutablePatch, updatedAt }, expectedUpdatedAt);
      if (!book) throw new NotFoundError('Book', id);
      return book;
    } catch (error: any) {
      if (String(error?.message).startsWith('STALE_UPDATE')) throw new ConflictError('The book changed since it was read; refresh before updating.');
      if (String(error?.message).startsWith('DUPLICATE')) throw new ConflictError('A book with the same slug already exists.');
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) throw new NotFoundError('Book', id);
  }

  async publishUploadedFile(bookId: string, editionId: string, file: BookFileRecord): Promise<void> {
    if (this.repository.publishUploadedFile) {
      await this.repository.publishUploadedFile(bookId, editionId, file);
      return;
    }
    const book = await this.get(bookId);
    const editions = book.editions.map((edition) => edition.id === editionId ? { ...edition, files: [{ ...file, sizeFormatted: `${Math.max(1, Math.round(file.sizeBytes / 1024))} KB` }] } : edition);
    await this.update(bookId, { editions, contentAvailability: 'FULL_TEXT', workflowStatus: 'PUBLISHED' });
  }
}
