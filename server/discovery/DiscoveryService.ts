import { DiscoveryProvider, DiscoveryProviderName, DiscoveryQuery, DiscoveryResponse, NexaraSearchResult, ProviderRawResult, ProviderReport } from './types';

type Clock = () => number;
interface CacheEntry { response: DiscoveryResponse; freshUntil: number; staleUntil: number; refreshing: boolean; }
interface CircuitState { failures: number; openUntil: number; }

function normalize(value: string | undefined): string { return (value || '').toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').trim(); }
function identityOf(raw: ProviderRawResult, provider: DiscoveryProviderName): string {
  if (raw.isbn) return `isbn:${normalize(raw.isbn).replace(/[^a-z0-9]/g, '')}`;
  const titleAuthor = `title-author:${normalize(raw.title)}:${normalize(raw.author)}`;
  if (normalize(raw.author)) return titleAuthor;
  if (raw.externalId) return `external:${provider}:${normalize(raw.externalId)}`;
  return titleAuthor;
}
function combineSignal(parent: AbortSignal, timeoutMs: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  parent.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, cancel: () => { clearTimeout(timer); parent.removeEventListener('abort', onAbort); } };
}
function sleep(ms: number, signal: AbortSignal): Promise<void> { return new Promise((resolve, reject) => { const timer = setTimeout(resolve, ms); signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); }, { once: true }); }); }
function score(query: string, raw: ProviderRawResult): { rankingScore: number; rankingReasons: string[] } {
  const q = normalize(query); const title = normalize(raw.title); const author = normalize(raw.author); const subjects = (raw.subjects || []).map(normalize);
  let rankingScore = 0; const rankingReasons: string[] = [];
  if (title === q) { rankingScore += 20; rankingReasons.push('exact title match (+20)'); }
  if (title.includes(q)) { rankingScore += 60; rankingReasons.push('title contains query (+60)'); }
  if (author.includes(q)) { rankingScore += 25; rankingReasons.push('author contains query (+25)'); }
  if (subjects.some((subject) => subject.includes(q))) { rankingScore += 10; rankingReasons.push('subject contains query (+10)'); }
  if (raw.contentAvailability === 'FULL_TEXT') { rankingScore += 8; rankingReasons.push('full text available (+8)'); }
  if (raw.rightsVerification === 'VERIFIED') { rankingScore += 5; rankingReasons.push('rights verified (+5)'); }
  return { rankingScore, rankingReasons };
}
function normalizeResult(query: string, provider: DiscoveryProviderName, raw: ProviderRawResult): NexaraSearchResult {
  const identity = identityOf(raw, provider); const ranking = score(query, raw);
  return { id: `${provider.toLowerCase()}-${raw.externalId || identity}`, identity, providers: [provider], providerExternalIds: raw.externalId ? { [provider]: raw.externalId } : {}, title: raw.title, author: raw.author || 'Unknown author', publicationYear: raw.publicationYear ?? null, language: raw.language || null, subjects: (raw.subjects || []).slice(0, 6), coverUrl: raw.coverUrl || null, externalUrl: raw.externalUrl || null, contentAvailability: raw.contentAvailability || 'UNAVAILABLE', rightsStatus: raw.rightsStatus || 'UNAVAILABLE', rightsVerification: raw.rightsVerification || 'UNVERIFIED', previewStatus: raw.previewStatus || 'NONE', ...ranking };
}

/** Provider isolation with deterministic retries, cached responses, SWR, and a per-provider circuit breaker. */
export class DiscoveryService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly circuits = new Map<DiscoveryProviderName, CircuitState>();
  constructor(private readonly providers: DiscoveryProvider[], private readonly now: Clock = () => Date.now()) {}
  private cacheKey(input: DiscoveryQuery) { return `${normalize(input.query)}:${Math.max(1, input.page)}:${Math.min(30, Math.max(1, input.limit))}`; }
  private circuit(provider: DiscoveryProviderName) { return this.circuits.get(provider) || { failures: 0, openUntil: 0 }; }
  private recordSuccess(provider: DiscoveryProviderName) { this.circuits.set(provider, { failures: 0, openUntil: 0 }); }
  private recordFailure(provider: DiscoveryProviderName) { const current = this.circuit(provider); const failures = current.failures + 1; this.circuits.set(provider, { failures, openUntil: failures >= 3 ? this.now() + 30_000 : 0 }); }

  async search(input: DiscoveryQuery, parentSignal: AbortSignal): Promise<DiscoveryResponse> {
    const key = this.cacheKey(input); const existing = this.cache.get(key); const now = this.now();
    if (existing && now <= existing.freshUntil) return { ...structuredClone(existing.response), cached: true };
    if (existing && now <= existing.staleUntil) {
      if (!existing.refreshing) {
        existing.refreshing = true;
        const refreshController = new AbortController();
        void this.searchFresh(input, refreshController.signal).then((response) => this.cache.set(key, { response, freshUntil: this.now() + 20_000, staleUntil: this.now() + 90_000, refreshing: false })).catch(() => { existing.refreshing = false; });
      }
      return { ...structuredClone(existing.response), cached: true };
    }
    const response = await this.searchFresh(input, parentSignal);
    this.cache.set(key, { response, freshUntil: this.now() + 20_000, staleUntil: this.now() + 90_000, refreshing: false });
    return response;
  }

  private async searchProvider(provider: DiscoveryProvider, query: string, parentSignal: AbortSignal): Promise<{ results: NexaraSearchResult[]; report: ProviderReport }> {
    const started = this.now(); const circuit = this.circuit(provider.name);
    if (circuit.openUntil > this.now()) return { results: [], report: { provider: provider.name, status: 'error', durationMs: 0, resultCount: 0, error: 'Provider circuit is open.' } };
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const child = combineSignal(parentSignal, provider.timeoutMs);
      try {
        const raw = await provider.search(query, { signal: child.signal, timeoutMs: provider.timeoutMs });
        if (parentSignal.aborted) return { results: [], report: { provider: provider.name, status: 'cancelled', durationMs: this.now() - started, resultCount: 0 } };
        const normalized = (Array.isArray(raw) ? raw : []).filter((item) => item && typeof item.title === 'string' && normalize(item.title).length > 0).map((item) => normalizeResult(query, provider.name, item));
        this.recordSuccess(provider.name);
        return { results: normalized, report: { provider: provider.name, status: normalized.length ? 'fulfilled' : 'empty', durationMs: this.now() - started, resultCount: normalized.length } };
      } catch (error) {
        const cancelled = parentSignal.aborted; const timedOut = child.signal.aborted && !parentSignal.aborted;
        if (cancelled) return { results: [], report: { provider: provider.name, status: 'cancelled', durationMs: this.now() - started, resultCount: 0 } };
        if (attempt < 2) { child.cancel(); await sleep(100 * attempt, parentSignal); continue; }
        this.recordFailure(provider.name);
        return { results: [], report: { provider: provider.name, status: timedOut ? 'timeout' : 'error', durationMs: this.now() - started, resultCount: 0, error: timedOut ? 'Provider timeout after a bounded retry.' : 'Provider failed after a bounded retry.' } };
      } finally { child.cancel(); }
    }
    return { results: [], report: { provider: provider.name, status: 'error', durationMs: this.now() - started, resultCount: 0, error: 'Provider retry budget exhausted.' } };
  }

  private async searchFresh(input: DiscoveryQuery, parentSignal: AbortSignal): Promise<DiscoveryResponse> {
    const query = input.query.trim(); const page = Math.max(1, input.page); const limit = Math.min(30, Math.max(1, input.limit));
    if (!query) return { data: [], query, page, limit, total: 0, providers: [], cached: false };
    const settled = await Promise.all(this.providers.map((provider) => this.searchProvider(provider, query, parentSignal)));
    const byIdentity = new Map<string, NexaraSearchResult>();
    for (const item of settled.flatMap((result) => result.results)) {
      const existing = byIdentity.get(item.identity);
      if (!existing) byIdentity.set(item.identity, item);
      else { existing.providers = Array.from(new Set([...existing.providers, ...item.providers])); existing.providerExternalIds = { ...existing.providerExternalIds, ...item.providerExternalIds }; existing.rankingScore = Math.max(existing.rankingScore, item.rankingScore); existing.rankingReasons = Array.from(new Set([...existing.rankingReasons, ...item.rankingReasons, 'duplicate provider records merged'])); if (existing.rightsVerification !== 'VERIFIED' && item.rightsVerification === 'VERIFIED') { existing.rightsVerification = item.rightsVerification; existing.rightsStatus = item.rightsStatus; } if (existing.contentAvailability === 'METADATA_ONLY' && item.contentAvailability !== 'METADATA_ONLY') existing.contentAvailability = item.contentAvailability; }
    }
    const ordered = Array.from(byIdentity.values()).sort((a, b) => b.rankingScore - a.rankingScore || a.title.localeCompare(b.title)); const offset = (page - 1) * limit;
    return { data: ordered.slice(offset, offset + limit), query, page, limit, total: ordered.length, providers: settled.map((result) => result.report), cached: false };
  }
}

export const defaultDiscoveryService = new DiscoveryService([]);
