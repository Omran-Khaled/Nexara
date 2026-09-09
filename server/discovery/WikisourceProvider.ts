import { DiscoveryProvider, ProviderRawResult, ProviderSearchContext } from './types';

interface WikiSearchResponse {
  query?: { search?: Array<{ title?: unknown; snippet?: unknown }> };
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
}

/**
 * Discovery intentionally provides metadata only. Rights and source text are checked
 * again by the reviewed-import gateway against the selected work page.
 */
export class WikisourceProvider implements DiscoveryProvider {
  readonly name = 'Wikisource' as const;
  readonly timeoutMs = 3_500;
  constructor(private readonly languages: readonly string[] = ['en', 'ar']) {}

  async search(query: string, context: ProviderSearchContext): Promise<ProviderRawResult[]> {
    const perLanguage = Math.max(2, Math.min(5, Math.ceil(context.timeoutMs > 0 ? 8 / this.languages.length : 3)));
    const responses = await Promise.all(this.languages.map(async (language) => {
      if (!/^[a-z]{2,12}$/.test(language)) return [] as ProviderRawResult[];
      const url = new URL(`https://${language}.wikisource.org/w/api.php`);
      url.search = new URLSearchParams({ action: 'query', list: 'search', srsearch: query, srlimit: String(perLanguage), format: 'json', formatversion: '2', origin: '*' }).toString();
      const response = await fetch(url, { signal: context.signal, headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`Wikisource (${language}) HTTP ${response.status}`);
      const payload = await response.json() as WikiSearchResponse;
      return (payload.query?.search || []).flatMap((item): ProviderRawResult[] => {
        const title = typeof item.title === 'string' ? item.title.trim() : '';
        if (!title) return [];
        return [{
          externalId: title,
          title,
          author: stripHtml(typeof item.snippet === 'string' ? item.snippet : '') || 'Wikisource',
          language,
          subjects: ['Wikisource'],
          externalUrl: `https://${language}.wikisource.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
          rightsStatus: 'UNAVAILABLE',
          rightsVerification: 'UNVERIFIED',
          contentAvailability: 'METADATA_ONLY',
          previewStatus: 'NONE',
        }];
      });
    }));
    return responses.flat().slice(0, 8);
  }
}
