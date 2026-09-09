import { http } from './http';
import { PageResult } from './http';

export type DiscoveryProviderName = 'OpenLibrary' | 'Gutenberg' | 'Wikisource' | 'ArabicCollectionsOnline' | 'Heritage';
export type DiscoveryStatus = 'fulfilled' | 'timeout' | 'error' | 'empty' | 'cancelled';
export interface DiscoveryResult {
  id: string;
  identity: string;
  providers: DiscoveryProviderName[];
  providerExternalIds?: Partial<Record<DiscoveryProviderName, string>>;
  title: string;
  author: string;
  publicationYear: number | null;
  language: string | null;
  subjects: string[];
  coverUrl: string | null;
  externalUrl: string | null;
  contentAvailability: 'FULL_TEXT' | 'PREVIEW' | 'METADATA_ONLY' | 'UNAVAILABLE';
  rightsStatus: 'PUBLIC_DOMAIN' | 'LICENSED' | 'RESTRICTED' | 'PREVIEW_ONLY' | 'UNAVAILABLE';
  rightsVerification: 'VERIFIED' | 'UNVERIFIED';
  previewStatus: 'NONE' | 'PROVIDER_PREVIEW' | 'NEXARA_RETRIEVED';
  rankingScore: number;
  rankingReasons: string[];
}
export interface DiscoveryProviderReport { provider: DiscoveryProviderName; status: DiscoveryStatus; durationMs: number; resultCount: number; error?: string; }
export interface DiscoveryResponse extends PageResult<DiscoveryResult> { query: string; providers: DiscoveryProviderReport[]; cached: boolean; }

export const discoveryApi = {
  search: (query: string, options: { page?: number; limit?: number; signal?: AbortSignal } = {}) => {
    const params = new URLSearchParams({ q: query, page: String(options.page ?? 1), limit: String(options.limit ?? 20) });
    return http.request<DiscoveryResponse>(`/discovery/search?${params.toString()}`, { signal: options.signal, timeoutMs: 8_000 });
  },
};
