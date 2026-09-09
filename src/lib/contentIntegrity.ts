import { Book, ContentAvailability } from '../types';

export const READER_CONTENT_AVAILABILITY: readonly ContentAvailability[] = ['FULL_TEXT', 'PREVIEW'];

export function canOpenInReader(book: Pick<Book, 'contentAvailability'>): boolean {
  return READER_CONTENT_AVAILABILITY.includes(book.contentAvailability);
}

export function contentAvailabilityLabel(
  availability: ContentAvailability,
  isArabic = false,
): string {
  const labels: Record<ContentAvailability, [string, string]> = {
    FULL_TEXT: ['Full text', 'نص كامل'],
    PREVIEW: ['Preview excerpts', 'مقتطفات معاينة'],
    METADATA_ONLY: ['Metadata only', 'بيانات وصفية فقط'],
    UNAVAILABLE: ['Content unavailable', 'النص غير متاح'],
  };

  return labels[availability][isArabic ? 1 : 0];
}

export function readerUnavailableMessage(
  availability: ContentAvailability,
  isArabic = false,
): string {
  if (availability === 'METADATA_ONLY') {
    return isArabic
      ? 'هذا السجل يحتوي بيانات وصفية فقط؛ لم يُحمّل نص قابل للقراءة من مصدر موثوق.'
      : 'This record contains metadata only; no readable text has been retrieved from a verified source.';
  }

  return isArabic
    ? 'نص هذا الكتاب غير متاح للقراءة داخل Nexara حالياً.'
    : 'This book’s text is not available to read inside Nexara at this time.';
}

export function isFullTextDownloadAllowed(book: Pick<Book, 'contentAvailability'>): boolean {
  return book.contentAvailability === 'FULL_TEXT';
}
