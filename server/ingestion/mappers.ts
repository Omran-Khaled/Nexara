import { ValidationError } from '../errors/ApplicationErrors';
import { IngestionSourceRecord, PersistableIngestionBook } from '../models/ingestion';
import { digest, iso, language, normalizedCover, slug } from './helpers';

export interface ExtractedChapter {
  id: string;
  pageNumber: number;
  title: string;
  titleAr: string;
  content: string;
  contentAr: string;
}

/**
 * Deterministic source-text segmentation into readable chapters. A section must
 * contain at least 400 characters to be considered a chapter.
 */
export function extractChapters(text: string, title: string, titleAr: string, jobId: string): ExtractedChapter[] {
  const selected = text.split(/\n\s*\n+/).map((entry) => entry.trim()).filter((entry) => entry.length >= 400).slice(0, 200);
  if (!selected.length) throw new ValidationError({ chapters: 'No readable source-text sections could be extracted.' });
  return selected.map((content, index) => ({
    id: `chapter-${jobId}-${index + 1}`,
    pageNumber: index + 1,
    title: selected.length === 1 ? title : `${title} — ${index + 1}`,
    titleAr: selected.length === 1 ? titleAr : `${titleAr} — ${index + 1}`,
    content,
    contentAr: content,
  }));
}

/**
 * Maps a verified external source record into the durable Nexara book model.
 * The author identity, work id, and edition id are all deterministic hashes of
 * the source record so a re-run converges on the same aggregates.
 */
export function buildPersistableBook(source: IngestionSourceRecord, jobId: string): PersistableIngestionBook {
  const authorName = source.authors[0] || 'Unknown author';
  const workId = `work-${digest(`${source.provider}:${source.externalId}:${authorName}:${source.title}`).slice(0, 20)}`;
  const bookId = `book-${digest(`${source.provider}:${source.externalId}`).slice(0, 20)}`;
  const primaryLanguage = language(source.language);
  const categories = source.subjects.slice(0, 3).length ? source.subjects.slice(0, 3) : ['Literature'];
  return {
    rights: source.rights!,
    book: {
      id: bookId,
      workId,
      slug: `${slug(source.title)}-${source.provider.toLowerCase()}-${source.externalId}`,
      title: source.title,
      titleAr: source.title,
      originalTitle: source.title,
      authorId: `author-${digest(authorName).slice(0, 20)}`,
      authorName,
      authorNameAr: authorName,
      coverImage: normalizedCover(source.coverUrl),
      description: `Verified ingestion candidate from ${source.provider}: ${source.sourceUrl}`,
      descriptionAr: `مرشح إدخال موثق من ${source.provider}: ${source.sourceUrl}`,
      genres: categories,
      genresAr: categories,
      categories,
      categoriesAr: categories,
      themes: source.subjects.slice(0, 5),
      themesAr: source.subjects.slice(0, 5),
      moods: ['contemplative'],
      rating: 0,
      ratingsCount: 0,
      reviewsCount: 0,
      downloadsCount: 0,
      readsCount: 0,
      featured: false,
      hiddenGem: false,
      editorialPick: false,
      forestRegion: 'archive-woods',
      forestCoords: { x: 50, y: 50 },
      readingDifficulty: 'Moderate',
      primaryLanguage,
      publicationYear: source.publicationYear || 0,
      editions: [{
        id: `edition-${jobId}`,
        language: primaryLanguage,
        languageName: primaryLanguage === 'ar' ? 'Arabic' : 'English',
        languageNameAr: primaryLanguage === 'ar' ? 'العربية' : 'الإنجليزية',
        publisher: source.provider,
        publicationYear: source.publicationYear || 0,
        pageCount: 0,
        estimatedMinutes: 0,
        rightsStatus: source.rights!.rightsStatus,
        licenseType: source.rights!.licenseType,
        source: source.rights!.source,
        attribution: source.rights!.attribution,
        files: [],
      }],
      chapters: [],
      contentAvailability: 'FULL_TEXT',
      workflowStatus: 'EDITORIAL_REVIEW',
      createdAt: iso(),
      updatedAt: iso(),
    },
  };
}