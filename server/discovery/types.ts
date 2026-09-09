import { ContentAvailability, RightsStatus } from '../../src/types';

export type DiscoveryProviderName = 'OpenLibrary' | 'Gutenberg' | 'Wikisource' | 'ArabicCollectionsOnline' | 'Heritage';
export type DiscoveryProviderStatus = 'fulfilled' | 'timeout' | 'error' | 'empty' | 'cancelled';

export interface DiscoveryQuery {
  query: string;
  page: number;
  limit: number;
}

export interface ProviderSearchContext {
  signal: AbortSignal;
  timeoutMs: number;
}

export interface ProviderRawResult {
  externalId?: string;
  isbn?: string;
  title: string;
  author?: string;
  publicationYear?: number;
  language?: string;
  subjects?: string[];
  coverUrl?: string;
  externalUrl?: string;
  rightsStatus?: RightsStatus;
  rightsVerification?: 'VERIFIED' | 'UNVERIFIED';
  contentAvailability?: ContentAvailability;
  previewStatus?: 'NONE' | 'PROVIDER_PREVIEW' | 'NEXARA_RETRIEVED';
}

export interface DiscoveryProvider {
  readonly name: DiscoveryProviderName;
  readonly timeoutMs: number;
  search(query: string, context: ProviderSearchContext): Promise<ProviderRawResult[]>;
}

export interface RankingEvidence {
  rankingScore: number;
  rankingReasons: string[];
}

export interface NexaraSearchResult extends RankingEvidence {
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
  contentAvailability: ContentAvailability;
  rightsStatus: RightsStatus;
  rightsVerification: 'VERIFIED' | 'UNVERIFIED';
  previewStatus: 'NONE' | 'PROVIDER_PREVIEW' | 'NEXARA_RETRIEVED';
}

export interface ProviderReport {
  provider: DiscoveryProviderName;
  status: DiscoveryProviderStatus;
  durationMs: number;
  resultCount: number;
  error?: string;
}

export interface DiscoveryResponse {
  data: NexaraSearchResult[];
  query: string;
  page: number;
  limit: number;
  total: number;
  providers: ProviderReport[];
  cached: boolean;
}
