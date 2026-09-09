import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/createApp';
import { InMemoryBookRepository } from '../server/repositories/BookRepository';
import { InMemoryAuditLogRepository, InMemoryBookmarkRepository, InMemoryCollectionRepository, InMemoryHighlightRepository, InMemoryReadingProgressRepository, InMemoryReviewRepository, InMemoryRightsRepository } from '../server/repositories/LibraryRepositories';

function call(server: http.Server, method: string, path: string, body?: Buffer, headers: Record<string, string> = {}, role: 'ADMIN' | 'READER' = 'ADMIN') {
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: address.port, path, method, headers: { ...headers, 'x-nexara-test-user': role === 'ADMIN' ? 'api-admin' : 'api-reader', 'x-nexara-test-role': role } }, (res) => { const chunks: Buffer[] = []; res.on('data', (chunk) => chunks.push(Buffer.from(chunk))); res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks) })); });
    req.on('error', reject); if (body) req.write(body); req.end();
  });
}
const main = async () => {
  const app = createApp({ bookRepository: new InMemoryBookRepository(), progressRepository: new InMemoryReadingProgressRepository(), bookmarkRepository: new InMemoryBookmarkRepository(), highlightRepository: new InMemoryHighlightRepository(), collectionRepository: new InMemoryCollectionRepository(), reviewRepository: new InMemoryReviewRepository(), rightsRepository: new InMemoryRightsRepository(), auditRepository: new InMemoryAuditLogRepository() });
  const server = app.listen(0);
  try {
    const payload = Buffer.from('%PDF-1.7\nP4 API gate\n%%EOF');
    const upload = await call(server, 'POST', '/api/books/book-api/editions/edition-api/files', payload, { 'content-type': 'application/pdf', 'x-file-format': 'PDF', 'x-download-allowed': 'false', 'x-reading-allowed': 'true' });
    assert.equal(upload.status, 201); const record = JSON.parse(upload.body.toString()).data; assert.equal(record.storageKey, undefined); assert.ok(record.checksum);
    const read = await call(server, 'GET', `/api/books/book-api/editions/edition-api/files/${record.id}/read-url`, undefined, {}, 'READER'); assert.equal(read.status, 200); const readData = JSON.parse(read.body.toString()).data; assert.match(readData.href, /mode=read/);
    const content = await call(server, 'GET', readData.href, undefined, {}, 'READER'); assert.equal(content.status, 200); assert.deepEqual(content.body, payload);
    const download = await call(server, 'GET', `/api/books/book-api/editions/edition-api/files/${record.id}/download-url`, undefined, {}, 'READER'); assert.equal(download.status, 403);
    console.log('P4 book file API gate passed.');
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
};
main().catch((error) => { console.error(error); process.exitCode = 1; });
