import { Author, Book } from '../../src/types';
import { MongoCatalogRepository } from '../repositories/CatalogRepository';
import { IngestionSourceRecord, PersistableIngestionBook } from '../models/ingestion';
import { slug } from './helpers';

export interface IngestionPublisher {
  persist(candidate: PersistableIngestionBook): Promise<Book>;
}

export class MongoIngestionPublisher implements IngestionPublisher {
  constructor(private readonly catalog: MongoCatalogRepository) {}

  async persist(candidate: PersistableIngestionBook): Promise<Book> {
    const book = candidate.book;
    const author: Author = {
      id: book.authorId,
      name: book.authorName,
      nameAr: book.authorNameAr,
      slug: `author-${slug(book.authorName)}`,
      avatar: '/covers/ingestion-placeholder.svg',
      birthYear: 0,
      era: 'Imported source record',
      eraAr: 'سجل مصدر مُدخل',
      country: 'Unknown',
      countryAr: 'غير محدد',
      bio: 'Author identity normalized from a verified external source record.',
      bioAr: 'هوية مؤلف جرى تطبيعها من سجل مصدر خارجي موثق.',
      timeline: [],
      languages: [book.primaryLanguage],
      relatedAuthorIds: [],
      followersCount: 0,
    };
    await this.catalog.upsertAuthor(author);
    await this.catalog.upsertWork({
      id: book.workId,
      authorId: book.authorId,
      slug: `work-${slug(book.title)}-${book.authorId.slice(-8)}`,
      title: book.title,
      titleAr: book.titleAr,
      originalTitle: book.originalTitle,
      description: book.description,
      descriptionAr: book.descriptionAr,
      primaryLanguage: book.primaryLanguage,
      publicationYear: book.publicationYear,
    });
    return this.catalog.upsertBookAggregate(book);
  }
}