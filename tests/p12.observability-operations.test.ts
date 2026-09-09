import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/createApp';
import { OperationalHealth } from '../server/observability/health';
import { recentServerRequestLog } from '../server/middleware/requestReliability';
import { InMemoryBookRepository } from '../server/repositories/BookRepository';
import { InMemoryAuditLogRepository, InMemoryBookmarkRepository, InMemoryCollectionRepository, InMemoryHighlightRepository, InMemoryReadingProgressRepository, InMemoryReviewRepository, InMemoryRightsRepository } from '../server/repositories/LibraryRepositories';

async function request(server: http.Server, path: string, requestId: string) {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: address.port, path, method: 'GET', headers: { 'x-request-id': requestId, 'x-nexara-test-user': 'p12-reader', 'x-nexara-test-role': 'READER' } }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => resolve({ status: res.statusCode || 0, body: raw ? JSON.parse(raw) : undefined }));
    });
    req.on('error', reject); req.end();
  });
}

const passing = new OperationalHealth([{ name: 'mongo', required: true, check: async () => undefined }]);
assert.equal((await passing.ready()).ready, true);
const failing = new OperationalHealth([{ name: 'mongo', required: true, check: async () => { throw new Error('database down'); } }]);
const failureReport = await failing.ready();
assert.equal(failureReport.ready, false);
assert.equal(failureReport.status, 'degraded');
assert.equal(failureReport.dependencies[0].status, 'failed');

const app = createApp({
  bookRepository: new InMemoryBookRepository(),
  progressRepository: new InMemoryReadingProgressRepository(),
  bookmarkRepository: new InMemoryBookmarkRepository(),
  highlightRepository: new InMemoryHighlightRepository(),
  collectionRepository: new InMemoryCollectionRepository(),
  reviewRepository: new InMemoryReviewRepository(),
  rightsRepository: new InMemoryRightsRepository(),
  auditRepository: new InMemoryAuditLogRepository(),
  health: failing,
});
const server = app.listen(0);
try {
  const live = await request(server, '/api/health/live', 'p12-live-request');
  assert.equal(live.status, 200);
  assert.equal(live.body.live, true);

  const ready = await request(server, '/api/health', 'p12-ready-request');
  assert.equal(ready.status, 503);
  assert.equal(ready.body.ready, false);
  assert.equal(ready.body.dependencies[0].name, 'mongo');
  assert.equal(ready.body.dependencies[0].status, 'failed');

  const readyAlias = await request(server, '/api/health/ready', 'p12-ready-alias');
  assert.equal(readyAlias.status, 503);
  const entry = recentServerRequestLog().find((record) => record.requestId === 'p12-ready-request');
  assert.ok(entry);
  assert.equal(entry.userId, 'p12-reader');
  assert.equal(entry.route, '/api/health');
  assert.equal(entry.status, 503);
  assert.ok(entry.durationMs >= 0);
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
console.log('P12 observability and operations checks passed.');
