import assert from 'node:assert/strict';
import { ApiError, HttpClient, recentNetworkLog } from '../src/api/http';
import { DiscoveryService } from '../server/discovery/DiscoveryService';
import { DiscoveryProvider } from '../server/discovery/types';
import { MongoBookRepository } from '../server/repositories/MongoBookRepository';

function delayed<T>(ms: number, signal: AbortSignal, value: T): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(value), ms);
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });
}

const raw = (title: string) => [{ externalId: title, title, author: 'Nexara', rightsStatus: 'PUBLIC_DOMAIN' as const, rightsVerification: 'VERIFIED' as const, contentAvailability: 'FULL_TEXT' as const, previewStatus: 'NONE' as const }];

const main = async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (_url, init) => {
      await delayed(12, init?.signal as AbortSignal, undefined);
      return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    const client = new HttpClient('/api');
    const latency = await client.request<{ data: unknown[] }>('/books', { timeoutMs: 80 });
    assert.deepEqual(latency, { data: [] }, 'bounded normal network latency should succeed');

    globalThis.fetch = (async (_url, init) => delayed(1_000, init?.signal as AbortSignal, new Response('{}'))) as typeof fetch;
    await assert.rejects(() => client.request('/books', { timeoutMs: 15, retry: false }), (error: unknown) => error instanceof ApiError && error.ui.kind === 'timeout' && !error.message.includes('operation was aborted'));

    const cancel = new AbortController();
    const pending = client.request('/books', { timeoutMs: 300, signal: cancel.signal, retry: false });
    setTimeout(() => cancel.abort(), 5);
    await assert.rejects(() => pending, (error: unknown) => error instanceof ApiError && error.ui.kind === 'cancelled' && !error.message.includes('operation was aborted'));

    let calls = 0;
    const cachedProvider: DiscoveryProvider = { name: 'OpenLibrary', timeoutMs: 50, async search(_query, context) { calls += 1; await delayed(5, context.signal, undefined); return raw('Cached Result'); } };
    const discovery = new DiscoveryService([cachedProvider]);
    const first = await discovery.search({ query: 'cached', page: 1, limit: 20 }, new AbortController().signal);
    const repeated = await discovery.search({ query: 'cached', page: 1, limit: 20 }, new AbortController().signal);
    assert.equal(first.cached, false); assert.equal(repeated.cached, true); assert.equal(calls, 1, 'repeated query must use the fresh cache');

    const concurrentProvider: DiscoveryProvider = { name: 'Gutenberg', timeoutMs: 100, async search(query, context) { await delayed(10, context.signal, undefined); return raw(query); } };
    const concurrent = new DiscoveryService([concurrentProvider]);
    const concurrentResults = await Promise.all(['one', 'two', 'three', 'four'].map((query) => concurrent.search({ query, page: 1, limit: 20 }, new AbortController().signal)));
    assert.deepEqual(concurrentResults.map((result) => result.data[0]?.title), ['one', 'two', 'three', 'four'], 'concurrent provider requests must remain isolated');

    let slowAttempts = 0;
    const slowProvider: DiscoveryProvider = { name: 'OpenLibrary', timeoutMs: 10, async search(_query, context) { slowAttempts += 1; return delayed(100, context.signal, raw('Slow')); } };
    const slow = await new DiscoveryService([slowProvider]).search({ query: 'slow', page: 1, limit: 20 }, new AbortController().signal);
    assert.equal(slow.providers[0].status, 'timeout'); assert.equal(slowAttempts, 2, 'slow provider receives one deterministic retry only');

    let failures = 0;
    const failingProvider: DiscoveryProvider = { name: 'Gutenberg', timeoutMs: 30, async search() { failures += 1; throw new Error('provider down'); } };
    const isolated = new DiscoveryService([failingProvider]);
    for (const query of ['failure-a', 'failure-b', 'failure-c', 'failure-d']) await isolated.search({ query, page: 1, limit: 20 }, new AbortController().signal);
    assert.equal(failures, 6, 'circuit breaker opens after three failed requests, each with one retry');

    let observedFilter: any; let observedFindOptions: any; let observedCountOptions: any;
    const fakeDb: any = { collection: () => ({
      find: (filter: unknown, options: unknown) => { observedFilter = filter; observedFindOptions = options; return { sort: () => ({ skip: () => ({ limit: () => ({ toArray: async () => [] }) }) }) }; },
      countDocuments: async (_filter: unknown, options: unknown) => { observedCountOptions = options; return 0; },
    }) };
    const mongo = new MongoBookRepository(fakeDb);
    const mongoResult = await mongo.search({ query: 'network reliability' }, { page: 1, limit: 10 });
    assert.equal(mongoResult.total, 0); assert.deepEqual(observedFilter.$text, { $search: 'network reliability' }); assert.equal(observedFindOptions.maxTimeMS, 1_500); assert.equal(observedCountOptions.maxTimeMS, 1_500);

    assert.ok(recentNetworkLog().some((entry) => entry.outcome === 'timeout'));
    assert.ok(recentNetworkLog().some((entry) => entry.outcome === 'cancelled'));
    console.log('P7 API/network reliability gate passed: latency, slow provider, provider failure, Mongo search budget, cancellation, concurrency, and repeated-query cache.');
  } finally { globalThis.fetch = originalFetch; }
};

main().catch((error) => { console.error(error); process.exitCode = 1; });
