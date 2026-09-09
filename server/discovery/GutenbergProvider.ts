import { DiscoveryProvider, ProviderRawResult, ProviderSearchContext } from './types';

function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 8) : []; }

export class GutenbergProvider implements DiscoveryProvider {
  readonly name = 'Gutenberg' as const;
  readonly timeoutMs = 3000;
  async search(query: string, context: ProviderSearchContext): Promise<ProviderRawResult[]> {
    const response = await fetch(`https://gutendex.com/books/?search=${encodeURIComponent(query)}`, { signal: context.signal });
    if (!response.ok) throw new Error(`Gutenberg HTTP ${response.status}`);
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { results?: unknown }).results)) return [];
    return ((payload as { results: unknown[] }).results).slice(0, 8).flatMap((item): ProviderRawResult[] => {
      if (!item || typeof item !== 'object') return [];
      const record = item as Record<string, unknown>;
      const id = typeof record.id === 'number' || typeof record.id === 'string' ? String(record.id) : undefined;
      const title = typeof record.title === 'string' ? record.title.trim() : '';
      if (!title || !id) return [];
      const authors = Array.isArray(record.authors) ? record.authors : [];
      const author = authors[0] && typeof authors[0] === 'object' && typeof (authors[0] as { name?: unknown }).name === 'string' ? String((authors[0] as { name: string }).name).replace(/, /g, ' ') : undefined;
      const languages = strings(record.languages);
      const subjects = strings(record.subjects);
      const formats = record.formats && typeof record.formats === 'object' ? record.formats as Record<string, unknown> : {};
      const coverUrl = typeof formats['image/jpeg'] === 'string' ? formats['image/jpeg'] : undefined;
      return [{
        externalId: id,
        title,
        author,
        language: languages[0],
        subjects,
        coverUrl,
        externalUrl: `https://www.gutenberg.org/ebooks/${id}`,
        rightsStatus: 'PUBLIC_DOMAIN',
        rightsVerification: 'VERIFIED',
        contentAvailability: 'METADATA_ONLY',
        previewStatus: 'NONE',
      }];
    });
  }
}
