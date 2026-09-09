import assert from 'node:assert/strict';
import { DiscoveryService } from '../server/discovery/DiscoveryService';
import { DiscoveryProvider, ProviderRawResult } from '../server/discovery/types';

const result = (title: string, providerId: string, overrides: Partial<ProviderRawResult> = {}): ProviderRawResult => ({ externalId: providerId, title, author: 'Author', subjects: ['Literature'], contentAvailability: 'METADATA_ONLY', rightsStatus: 'UNAVAILABLE', rightsVerification: 'UNVERIFIED', previewStatus: 'NONE', ...overrides });
const delay = <T>(signal: AbortSignal, ms: number, value: T): Promise<T> => new Promise((resolve, reject) => { const timer = setTimeout(() => resolve(value), ms); signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('aborted', 'AbortError')); }, { once: true }); });
const provider = (name: DiscoveryProvider['name'], timeoutMs: number, fn: (query: string, signal: AbortSignal) => Promise<ProviderRawResult[]>): DiscoveryProvider => ({ name, timeoutMs, search: (query, context) => fn(query, context.signal) });

async function run() {
  const successful = new DiscoveryService([provider('Heritage', 100, async () => [result('War and Peace', 'one')])]);
  const successResponse = await successful.search({ query: 'war', page: 1, limit: 20 }, new AbortController().signal);
  assert.equal(successResponse.data.length, 1);
  assert.equal(successResponse.providers[0].status, 'fulfilled');

  const timedOut = new DiscoveryService([provider('OpenLibrary', 20, async (_q, signal) => delay(signal, 100, [result('Slow', 'slow')]))]);
  const timeoutResponse = await timedOut.search({ query: 'slow', page: 1, limit: 20 }, new AbortController().signal);
  assert.equal(timeoutResponse.providers[0].status, 'timeout');

  const errored = new DiscoveryService([provider('Gutenberg', 100, async () => { throw new Error('provider down'); })]);
  const errorResponse = await errored.search({ query: 'error', page: 1, limit: 20 }, new AbortController().signal);
  assert.equal(errorResponse.providers[0].status, 'error');

  const empty = new DiscoveryService([provider('Heritage', 100, async () => [])]);
  const emptyResponse = await empty.search({ query: 'none', page: 1, limit: 20 }, new AbortController().signal);
  assert.equal(emptyResponse.providers[0].status, 'empty');

  const duplicate = new DiscoveryService([
    provider('OpenLibrary', 100, async () => [result('The Republic', 'ol-1', { author: 'Plato' })]),
    provider('Gutenberg', 100, async () => [result('The Republic', 'gut-1', { author: 'Plato' })]),
  ]);
  const duplicateResponse = await duplicate.search({ query: 'republic', page: 1, limit: 20 }, new AbortController().signal);
  assert.equal(duplicateResponse.data.length, 1, 'cross-provider title-author identity must merge duplicates');
  assert.equal(duplicateResponse.data[0].providers.length, 2);

  const parallelStarts: number[] = [];
  const parallel = new DiscoveryService([
    provider('OpenLibrary', 500, async (_q, signal) => { parallelStarts.push(Date.now()); return delay(signal, 60, [result('Fast', 'fast')]); }),
    provider('Gutenberg', 500, async (_q, signal) => { parallelStarts.push(Date.now()); return delay(signal, 60, [result('Also Fast', 'also-fast')]); }),
  ]);
  const parallelStartedAt = Date.now();
  const parallelResponse = await parallel.search({ query: 'fast', page: 1, limit: 20 }, new AbortController().signal);
  assert.equal(parallelResponse.data.length, 2);
  assert.ok(Date.now() - parallelStartedAt < 120, 'providers should run concurrently rather than serially');
  assert.ok(Math.abs(parallelStarts[0] - parallelStarts[1]) < 40);

  const cancellationController = new AbortController();
  const cancellable = new DiscoveryService([provider('OpenLibrary', 500, async (_q, signal) => delay(signal, 200, [result('Cancelled', 'cancelled')]))]);
  const cancellationPromise = cancellable.search({ query: 'war', page: 1, limit: 20 }, cancellationController.signal);
  setTimeout(() => cancellationController.abort(), 10);
  const cancellationResponse = await cancellationPromise;
  assert.equal(cancellationResponse.providers[0].status, 'cancelled');
  assert.equal(cancellationResponse.data.length, 0);

  const malformed = new DiscoveryService([provider('Gutenberg', 100, async () => [({ title: '' } as ProviderRawResult), result('Valid', 'valid')])]);
  const malformedResponse = await malformed.search({ query: 'valid', page: 1, limit: 20 }, new AbortController().signal);
  assert.equal(malformedResponse.data.length, 1, 'malformed/empty titles must be discarded during normalization');
  assert.equal(malformedResponse.data[0].title, 'Valid');

  const allFail = new DiscoveryService([
    provider('OpenLibrary', 100, async () => { throw new Error('down'); }),
    provider('Gutenberg', 100, async () => { throw new Error('down'); }),
    provider('Heritage', 100, async () => { throw new Error('down'); }),
  ]);
  const allFailResponse = await allFail.search({ query: 'all fail', page: 1, limit: 20 }, new AbortController().signal);
  assert.equal(allFailResponse.data.length, 0);
  assert.ok(allFailResponse.providers.every((report) => report.status === 'error'));

  const fallbackOnly = new DiscoveryService([provider('OpenLibrary', 100, async () => []), provider('Gutenberg', 100, async () => []), provider('Heritage', 100, async () => [result('Fallback Heritage', 'fallback', { rightsVerification: 'UNVERIFIED', contentAvailability: 'METADATA_ONLY' })])]);
  const fallbackResponse = await fallbackOnly.search({ query: 'fallback', page: 1, limit: 20 }, new AbortController().signal);
  assert.equal(fallbackResponse.data.length, 1);
  assert.equal(fallbackResponse.data[0].contentAvailability, 'METADATA_ONLY');
  assert.equal(fallbackResponse.data[0].rightsVerification, 'UNVERIFIED');

  const explainable = new DiscoveryService([provider('Gutenberg', 100, async () => [result('War', 'ranked', { author: 'War Author', contentAvailability: 'FULL_TEXT', rightsVerification: 'VERIFIED', rightsStatus: 'PUBLIC_DOMAIN' })])]);
  const ranked = await explainable.search({ query: 'war', page: 1, limit: 20 }, new AbortController().signal);
  assert.ok(ranked.data[0].rankingScore > 0);
  assert.ok(ranked.data[0].rankingReasons.length > 0);

  console.log('P3 discovery reliability checks passed.');
}

void run();
