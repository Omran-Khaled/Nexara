import assert from 'node:assert/strict';
import http from 'node:http';
import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
import { INITIAL_BOOKS } from './fixtures/libraryFixtures';
import { createApp } from '../server/createApp';
import { DiscoveryService } from '../server/discovery/DiscoveryService';
import { DiscoveryProvider } from '../server/discovery/types';
import { InMemoryBookRepository } from '../server/repositories/BookRepository';
import { InMemoryAuditLogRepository, InMemoryBookmarkRepository, InMemoryCollectionRepository, InMemoryHighlightRepository, InMemoryReadingProgressRepository, InMemoryReviewRepository, InMemoryRightsRepository } from '../server/repositories/LibraryRepositories';

const provider: DiscoveryProvider = { name: 'Heritage', timeoutMs: 100, async search(query) { return [{ externalId: `perf-${query}`, title: `${query} title`, author: 'Performance Author' }]; } };
const bookRepository = new InMemoryBookRepository(structuredClone(INITIAL_BOOKS));
const app = createApp({ bookRepository, progressRepository: new InMemoryReadingProgressRepository(), bookmarkRepository: new InMemoryBookmarkRepository(), highlightRepository: new InMemoryHighlightRepository(), collectionRepository: new InMemoryCollectionRepository(), reviewRepository: new InMemoryReviewRepository(), rightsRepository: new InMemoryRightsRepository(), auditRepository: new InMemoryAuditLogRepository(), discoveryService: new DiscoveryService([provider]) });
const server = app.listen(0);

async function request(path: string): Promise<number> {
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: address.port, path, method: 'GET', headers: { 'x-nexara-test-user': 'p5-performance-user', 'x-nexara-test-role': 'ADMIN' } }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode || 0)); });
    req.on('error', reject); req.end();
  });
}
function summarize(values: number[]) { const sorted = [...values].sort((a, b) => a - b); const at = (fraction: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]; return { samples: values.length, minMs: sorted[0], medianMs: at(0.5), p95Ms: at(0.95), maxMs: sorted[sorted.length - 1], meanMs: values.reduce((a, b) => a + b, 0) / values.length }; }
async function measure(path: string, samples = 20) { const values: number[] = []; for (let i = 0; i < samples; i += 1) { const started = performance.now(); assert.equal(await request(path), 200); values.push(Number((performance.now() - started).toFixed(3))); } return summarize(values); }

try {
  const api = await measure('/api/books?query=book&limit=20');
  const discovery = await measure('/api/discovery/search?q=Plato&limit=10');
  const repositoryValues: number[] = [];
  for (let i = 0; i < 20; i += 1) { const started = performance.now(); const result = await bookRepository.search({ query: 'book' }, { page: 1, limit: 20 }); assert.ok(result.data.length >= 0); repositoryValues.push(Number((performance.now() - started).toFixed(3))); }
  const repository = summarize(repositoryValues);
  const report = { measuredAt: new Date().toISOString(), environment: 'local sandbox', samplesPerFlow: 20, api, discovery, repository, note: 'Measurements are observations, not release thresholds.' };
  await mkdir('artifacts/performance', { recursive: true });
  await writeFile('artifacts/performance/p5-performance.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
