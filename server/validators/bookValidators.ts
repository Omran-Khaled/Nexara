import { Book, ContentAvailability, WorkflowStatus } from '../../src/types';
import { ValidationError } from '../errors/ApplicationErrors';
import { isStrictIsoUtc } from '../utils/semantics';

const availability: ContentAvailability[] = ['FULL_TEXT', 'PREVIEW', 'METADATA_ONLY', 'UNAVAILABLE'];
const workflows: WorkflowStatus[] = ['DRAFT', 'METADATA_REVIEW', 'RIGHTS_VERIFICATION', 'FILE_VALIDATION', 'EDITORIAL_REVIEW', 'PUBLISHED', 'ARCHIVED'];
const difficulties = ['Accessible', 'Moderate', 'Demanding', 'Scholar'];
const formats = ['PDF', 'EPUB', 'TXT', 'HTML'];
const rights = ['PUBLIC_DOMAIN', 'LICENSED', 'OPEN_ACCESS', 'PREVIEW_ONLY', 'RESTRICTED', 'UNAVAILABLE'];
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError('body must be an object.'); return value as Record<string, unknown>; }
function string(value: unknown, field: string, max = 10_000) { if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new ValidationError({ [field]: `must be a non-empty string with at most ${max} characters.` }); return value.trim(); }
function integer(value: unknown, field: string, minimum?: number) { if (!Number.isInteger(value) || (minimum !== undefined && (value as number) < minimum)) throw new ValidationError({ [field]: `must be an integer${minimum === undefined ? '' : ` >= ${minimum}`}.` }); return value as number; }
function number(value: unknown, field: string, minimum?: number) { if (typeof value !== 'number' || !Number.isFinite(value) || (minimum !== undefined && value < minimum)) throw new ValidationError({ [field]: `must be a number${minimum === undefined ? '' : ` >= ${minimum}`}.` }); return value; }
function bool(value: unknown, field: string) { if (typeof value !== 'boolean') throw new ValidationError({ [field]: 'must be boolean.' }); return value; }
function stringArray(value: unknown, field: string) { if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) throw new ValidationError({ [field]: 'must be an array of non-empty strings.' }); return value; }
function validateNested(input: Record<string, unknown>) {
  if (!Array.isArray(input.editions)) throw new ValidationError({ editions: 'must be an array.' });
  if (!Array.isArray(input.chapters)) throw new ValidationError({ chapters: 'must be an array.' });
  const editionIds = new Set<string>(); const isbnValues = new Set<string>();
  for (const edition of input.editions as unknown[]) { const value = object(edition); const id = string(value.id, 'editions[].id'); if (editionIds.has(id)) throw new ValidationError({ editions: 'cannot contain duplicate edition ids.' }); editionIds.add(id); if (value.isbn !== undefined) { const isbn = string(value.isbn, 'editions[].isbn', 64).replace(/[-\s]/g, '').toUpperCase(); if (isbnValues.has(isbn)) throw new ValidationError({ editions: 'cannot contain duplicate ISBN values.' }); isbnValues.add(isbn); } string(value.language, 'editions[].language', 16); string(value.languageName, 'editions[].languageName', 120); string(value.languageNameAr, 'editions[].languageNameAr', 120); string(value.publisher, 'editions[].publisher', 300); integer(value.publicationYear, 'editions[].publicationYear'); integer(value.pageCount, 'editions[].pageCount', 0); integer(value.estimatedMinutes, 'editions[].estimatedMinutes', 0); if (!rights.includes(value.rightsStatus as string)) throw new ValidationError({ 'editions[].rightsStatus': 'has an unsupported value.' }); string(value.licenseType, 'editions[].licenseType', 300); string(value.source, 'editions[].source', 1_000); string(value.attribution, 'editions[].attribution', 2_000); if (!Array.isArray(value.files)) throw new ValidationError({ 'editions[].files': 'must be an array.' }); const fileIds = new Set<string>(); for (const file of value.files as unknown[]) { const fileValue = object(file); const fileId = string(fileValue.id, 'editions[].files[].id'); if (fileIds.has(fileId)) throw new ValidationError({ 'editions[].files': 'cannot contain duplicate file ids.' }); fileIds.add(fileId); if (!formats.includes(fileValue.format as string)) throw new ValidationError({ 'editions[].files[].format': 'has an unsupported value.' }); integer(fileValue.sizeBytes, 'editions[].files[].sizeBytes', 0); string(fileValue.sizeFormatted, 'editions[].files[].sizeFormatted', 64); bool(fileValue.downloadAllowed, 'editions[].files[].downloadAllowed'); bool(fileValue.readingAllowed, 'editions[].files[].readingAllowed'); bool(fileValue.offlineAllowed, 'editions[].files[].offlineAllowed'); } }
  const chapterIds = new Set<string>();
  for (const chapter of input.chapters as unknown[]) { const value = object(chapter); const id = string(value.id, 'chapters[].id'); if (chapterIds.has(id)) throw new ValidationError({ chapters: 'cannot contain duplicate chapter ids.' }); chapterIds.add(id); integer(value.pageNumber, 'chapters[].pageNumber', 1); string(value.title, 'chapters[].title'); string(value.titleAr, 'chapters[].titleAr'); string(value.content, 'chapters[].content'); string(value.contentAr, 'chapters[].contentAr'); }
}

export function validateBookWrite(body: unknown): Book {
  const input = object(body);
  for (const field of ['id', 'workId', 'slug', 'title', 'titleAr', 'authorId', 'authorName', 'authorNameAr', 'description', 'descriptionAr', 'coverImage', 'primaryLanguage', 'forestRegion', 'readingDifficulty']) string(input[field], field);
  for (const field of ['genres', 'genresAr', 'categories', 'categoriesAr', 'themes', 'themesAr', 'moods']) stringArray(input[field], field);
  for (const field of ['featured', 'hiddenGem', 'editorialPick']) bool(input[field], field);
  for (const field of ['rating', 'ratingsCount', 'reviewsCount', 'downloadsCount', 'readsCount']) number(input[field], field, 0);
  integer(input.publicationYear, 'publicationYear');
  if (!difficulties.includes(input.readingDifficulty as string)) throw new ValidationError({ readingDifficulty: 'has an unsupported value.' });
  if (!availability.includes(input.contentAvailability as ContentAvailability)) throw new ValidationError({ contentAvailability: 'has an unsupported value.' });
  if (!workflows.includes(input.workflowStatus as WorkflowStatus)) throw new ValidationError({ workflowStatus: 'has an unsupported value.' });
  const coords = object(input.forestCoords); const x = number(coords.x, 'forestCoords.x', 0); const y = number(coords.y, 'forestCoords.y', 0); if (x > 100 || y > 100) throw new ValidationError({ forestCoords: 'coordinates must be between 0 and 100.' });
  validateNested(input);
  const chapters = input.chapters as unknown[];
  const files = (input.editions as unknown[]).flatMap((edition) => ((edition as Record<string, unknown>).files as unknown[]));
  if (['METADATA_ONLY', 'UNAVAILABLE'].includes(input.contentAvailability as string) && chapters.length > 0) throw new ValidationError({ chapters: 'metadata-only or unavailable books cannot contain readable chapters.' });
  if (input.contentAvailability === 'UNAVAILABLE' && files.some((file) => (file as Record<string, unknown>).readingAllowed === true)) throw new ValidationError({ contentAvailability: 'UNAVAILABLE books cannot expose readable files.' });
  if (['FULL_TEXT', 'PREVIEW'].includes(input.contentAvailability as string) && chapters.length === 0 && !files.some((file) => (file as Record<string, unknown>).readingAllowed === true)) throw new ValidationError({ contentAvailability: 'readable content requires chapters or a readable file.' });
  if (input.workflowStatus === 'PUBLISHED' && input.contentAvailability === 'UNAVAILABLE') throw new ValidationError({ workflowStatus: 'published books cannot be unavailable.' });
  return input as unknown as Book;
}

export function validateBookPatch(body: unknown): Partial<Book> & { expectedUpdatedAt?: string } {
  const input = object(body);
  const permitted = new Set(['title', 'titleAr', 'description', 'descriptionAr', 'coverImage', 'genres', 'genresAr', 'categories', 'categoriesAr', 'themes', 'themesAr', 'moods', 'featured', 'hiddenGem', 'editorialPick', 'forestRegion', 'forestCoords', 'readingDifficulty', 'publicationYear', 'editions', 'chapters', 'contentAvailability', 'workflowStatus', 'expectedUpdatedAt']);
  for (const key of Object.keys(input)) if (!permitted.has(key)) throw new ValidationError({ [key]: 'is not a mutable book field.' });
  if (!Object.keys(input).length) throw new ValidationError('body must include at least one mutable field.');
  if ('expectedUpdatedAt' in input && !isStrictIsoUtc(input.expectedUpdatedAt)) throw new ValidationError({ expectedUpdatedAt: 'must be a strict ISO-8601 UTC timestamp.' });
  if ('contentAvailability' in input && !availability.includes(input.contentAvailability as ContentAvailability)) throw new ValidationError({ contentAvailability: 'has an unsupported value.' });
  if ('workflowStatus' in input && !workflows.includes(input.workflowStatus as WorkflowStatus)) throw new ValidationError({ workflowStatus: 'has an unsupported value.' });
  if ('publicationYear' in input) integer(input.publicationYear, 'publicationYear');
  if ('readingDifficulty' in input && !difficulties.includes(input.readingDifficulty as string)) throw new ValidationError({ readingDifficulty: 'has an unsupported value.' });
  for (const key of ['genres', 'genresAr', 'categories', 'categoriesAr', 'themes', 'themesAr', 'moods']) if (key in input) stringArray(input[key], key);
  for (const key of ['featured', 'hiddenGem', 'editorialPick']) if (key in input) bool(input[key], key);
  if ('forestCoords' in input) { const coords = object(input.forestCoords); const x = number(coords.x, 'forestCoords.x', 0); const y = number(coords.y, 'forestCoords.y', 0); if (x > 100 || y > 100) throw new ValidationError({ forestCoords: 'coordinates must be between 0 and 100.' }); }
  if ('editions' in input || 'chapters' in input) validateNested({ editions: input.editions ?? [], chapters: input.chapters ?? [] });
  if (input.contentAvailability === 'METADATA_ONLY' && Array.isArray(input.chapters) && input.chapters.length > 0) throw new ValidationError({ chapters: 'metadata-only books cannot contain readable chapters.' });
  if (input.contentAvailability === 'UNAVAILABLE' && Array.isArray(input.chapters) && input.chapters.length > 0) throw new ValidationError({ chapters: 'unavailable books cannot contain readable chapters.' });
  return input as Partial<Book> & { expectedUpdatedAt?: string };
}
