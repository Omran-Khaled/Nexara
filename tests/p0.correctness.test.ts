import assert from 'node:assert/strict';
import { canOpenInReader } from '../src/lib/contentIntegrity';
import { Book } from '../src/types';

const fullTextBook: Book = {
  id: 'full-text-test',
  workId: 'work-full-text-test',
  slug: 'full-text-test',
  title: 'Full Text Test',
  titleAr: 'اختبار النص الكامل',
  authorId: 'author-test',
  authorName: 'Test Author',
  authorNameAr: 'مؤلف الاختبار',
  coverImage: 'https://example.invalid/cover.jpg',
  description: 'A test book with actual supplied text.',
  descriptionAr: 'كتاب اختبار يحتوي على نص مقدّم فعلياً.',
  genres: ['Test'],
  genresAr: ['اختبار'],
  categories: ['Test'],
  categoriesAr: ['اختبار'],
  themes: ['Test'],
  themesAr: ['اختبار'],
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
  forestCoords: { x: 0, y: 0 },
  readingDifficulty: 'Accessible',
  primaryLanguage: 'en',
  publicationYear: 2026,
  editions: [],
  chapters: [
    {
      id: 'chapter-1',
      pageNumber: 1,
      title: 'Chapter 1',
      titleAr: 'الفصل الأول',
      content: 'A verified full-text test passage.',
      contentAr: 'مقطع اختبار للنص الكامل تم تقديمه.',
    },
  ],
  contentAvailability: 'FULL_TEXT',
  workflowStatus: 'PUBLISHED',
  createdAt: '2026-08-15T00:00:00.000Z',
  updatedAt: '2026-08-15T00:00:00.000Z',
};

const metadataBook: Book = {
  ...fullTextBook,
  id: 'metadata-only-test', workId: 'work-metadata-only-test', slug: 'metadata-only-test', title: 'Metadata Record', titleAr: 'سجل بيانات وصفية',
  chapters: [], contentAvailability: 'METADATA_ONLY', workflowStatus: 'DRAFT',
  editions: [{ id: 'metadata-edition', language: 'en', languageName: 'English', languageNameAr: 'الإنجليزية', publisher: 'Source metadata', publicationYear: 1900, pageCount: 0, estimatedMinutes: 0, rightsStatus: 'UNAVAILABLE', licenseType: 'Unverified', source: 'https://example.invalid/source', attribution: 'Metadata source', files: [] }],
};

function testReaderAdmissionAndMetadataState(): void {
  assert.equal(metadataBook.contentAvailability, 'METADATA_ONLY');
  assert.equal(metadataBook.chapters.length, 0, 'Metadata records must not gain generated chapters.');
  assert.equal(metadataBook.editions[0].files.length, 0, 'Metadata records must not advertise local downloads.');
  assert.equal(canOpenInReader(metadataBook), false, 'Metadata-only records must be blocked from the reader.');
  assert.equal(canOpenInReader(fullTextBook), true, 'A supplied full-text record may enter the reader.');
}

function testImportedRecordsHaveNoSyntheticEngagement(): void {
  assert.equal(metadataBook.rating, 0);
  assert.equal(metadataBook.ratingsCount, 0);
  assert.equal(metadataBook.reviewsCount, 0);
  assert.equal(metadataBook.downloadsCount, 0);
  assert.equal(metadataBook.readsCount, 0);
  assert.equal(metadataBook.workflowStatus, 'DRAFT');
}

function testNoSyntheticDownloadAdvertisement(): void {
  assert.equal(fullTextBook.editions.length, 0, 'A supplied reader text alone must not be represented as a downloadable file.');
  assert.equal(metadataBook.editions[0].files.length, 0, 'No synthetic PDF, HTML, or TXT file may be advertised for metadata-only records.');
}

testReaderAdmissionAndMetadataState();
testImportedRecordsHaveNoSyntheticEngagement();
testNoSyntheticDownloadAdvertisement();
console.log('P0 correctness unit checks passed.');
