import { DiscoveryProvider, ProviderRawResult, ProviderSearchContext } from './types';

function arrayOfStrings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 8) : []; }
function safeYear(value: unknown): number | undefined { return typeof value === 'number' && Number.isFinite(value) ? value : undefined; }

export class OpenLibraryProvider implements DiscoveryProvider {
  readonly name = 'OpenLibrary' as const;
  readonly timeoutMs = 3500;
  async search(query: string, context: ProviderSearchContext): Promise<ProviderRawResult[]> {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8&fields=key,title,author_name,first_publish_year,cover_i,subject,language,isbn`; 
    const response = await fetch(url, { signal: context.signal });
    if (!response.ok) throw new Error(`OpenLibrary HTTP ${response.status}`);
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { docs?: unknown }).docs)) return [];
    return ((payload as { docs: unknown[] }).docs).flatMap((doc): ProviderRawResult[] => {
      if (!doc || typeof doc !== 'object') return [];
      const record = doc as Record<string, unknown>;
      const key = typeof record.key === 'string' ? record.key : undefined;
      const title = typeof record.title === 'string' ? record.title.trim() : '';
      if (!title) return [];
      const authors = arrayOfStrings(record.author_name);
      const isbns = arrayOfStrings(record.isbn);
      const coverId = typeof record.cover_i === 'number' ? record.cover_i : undefined;
      const languages = arrayOfStrings(record.language);
      const subjects = arrayOfStrings(record.subject);
      return [{
        externalId: key?.replace('/works/', ''),
        isbn: isbns[0],
        title,
        author: authors[0],
        publicationYear: safeYear(record.first_publish_year),
        language: languages[0],
        subjects,
        coverUrl: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : undefined,
        externalUrl: key ? `https://openlibrary.org${key}` : undefined,
        rightsStatus: 'UNAVAILABLE',
        rightsVerification: 'UNVERIFIED',
        contentAvailability: 'METADATA_ONLY',
        previewStatus: 'NONE',
      }];
    });
  }
}
