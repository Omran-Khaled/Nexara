import { Book, BookChapter, BookEdition, BookFile } from '../../src/types';

/**
 * MongoDB aggregate for Nexara catalogue reads. Author data is an immutable display
 * snapshot in the aggregate because the current UI reads it with every book. Editions,
 * digital assets, and chapters are embedded for the same read path.
 */
export interface AuthorSnapshot {
  id: string;
  name: string;
  nameAr: string;
}

export interface DigitalAssetModel extends BookFile {}
export interface EditionModel extends Omit<BookEdition, 'files'> { files: DigitalAssetModel[]; }
export interface ChapterModel extends BookChapter {}
export interface BookDocument extends Omit<Book, 'editions' | 'chapters'> {
  editions: EditionModel[];
  chapters: ChapterModel[];
}

export function toBookApi(document: BookDocument): Book {
  return structuredClone(document) as Book;
}
