import { DiscoveryProvider, ProviderRawResult, ProviderSearchContext } from './types';

function text(value: string): string {
  return value.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&#39;/gi, "'").replace(/&quot;/gi, '"').replace(/\s+/g, ' ').trim();
}

/** ACO search is metadata discovery only; title-specific rights and PDF links are revalidated on review. */
export class ArabicCollectionsOnlineProvider implements DiscoveryProvider {
  readonly name = 'ArabicCollectionsOnline' as const;
  readonly timeoutMs = 4_000;

  async search(query: string, context: ProviderSearchContext): Promise<ProviderRawResult[]> {
    const url = new URL('https://aco.dlib.nyu.edu/search');
    url.search = new URLSearchParams({ search: query, scope: 'matches' }).toString();
    const response = await fetch(url, { signal: context.signal, headers: { accept: 'text/html,application/xhtml+xml' } });
    if (!response.ok) throw new Error(`Arabic Collections Online HTTP ${response.status}`);
    const html = await response.text();
    const seen = new Set<string>();
    const result: ProviderRawResult[] = [];
    for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']*\/book\/([A-Za-z0-9_-]+)\/\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const externalId = match[2];
      const title = text(match[3]);
      if (!externalId || !title || seen.has(externalId)) continue;
      seen.add(externalId);
      result.push({
        externalId,
        title,
        author: 'Arabic Collections Online',
        language: 'ar',
        subjects: ['Arabic Collections Online'],
        externalUrl: new URL(match[1], 'https://aco.dlib.nyu.edu').toString(),
        rightsStatus: 'UNAVAILABLE',
        rightsVerification: 'UNVERIFIED',
        contentAvailability: 'METADATA_ONLY',
        previewStatus: 'NONE',
      });
      if (result.length >= 8) break;
    }
    return result;
  }
}
