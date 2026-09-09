import { randomUUID } from 'node:crypto';
import { S3CompatibleStorageProvider, checksumOf } from '../server/storage/StorageProvider';

const endpoint = process.env.BOOK_STORAGE_ENDPOINT;
const region = process.env.BOOK_STORAGE_REGION || 'auto';
const bucket = process.env.BOOK_STORAGE_BUCKET;
const accessKeyId = process.env.BOOK_STORAGE_ACCESS_KEY;
const secretAccessKey = process.env.BOOK_STORAGE_SECRET_KEY;
if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) throw new Error('Complete BOOK_STORAGE_* configuration is required.');

const provider = new S3CompatibleStorageProvider({ endpoint, region, bucket, accessKeyId, secretAccessKey });
const storageKey = `nexara-preflight/storage-roundtrip-${randomUUID()}.txt`;
const directStorageKey = `nexara-preflight/direct-upload-${randomUUID()}.txt`;
const payload = Buffer.from(`Nexara storage verification ${new Date().toISOString()}`, 'utf8');
const expectedChecksum = checksumOf(payload);

try {
  await provider.checkHealth();
  const stored = await provider.put({ storageKey, body: payload, mimeType: 'text/plain', expectedChecksum });
  const fetched = await provider.get(storageKey);
  const chunks: Buffer[] = [];
  for await (const chunk of fetched.stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const received = Buffer.concat(chunks);
  const signedUrl = await provider.signedReadUrl(storageKey, 60);
  const signedResponse = await fetch(signedUrl, { signal: AbortSignal.timeout(10_000) });
  const signedBody = Buffer.from(await signedResponse.arrayBuffer());
  if (!signedResponse.ok) throw new Error(`Signed read returned HTTP ${signedResponse.status}.`);
  const directUploadUrl = await provider.signedWriteUrl!(directStorageKey, 'text/plain', 60);
  const directUploadResponse = await fetch(directUploadUrl, { method: 'PUT', headers: { 'content-type': 'text/plain' }, body: payload, signal: AbortSignal.timeout(10_000) });
  if (!directUploadResponse.ok) throw new Error(`Signed write returned HTTP ${directUploadResponse.status}.`);
  const directFetched = await provider.get(directStorageKey);
  const directChunks: Buffer[] = [];
  for await (const chunk of directFetched.stream) directChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (!received.equals(payload) || !signedBody.equals(payload) || !Buffer.concat(directChunks).equals(payload) || stored.checksum !== expectedChecksum || fetched.checksum !== expectedChecksum) {
    throw new Error('Storage roundtrip checksum or content verification failed.');
  }
  await provider.delete(storageKey);
  await provider.delete(directStorageKey);
  if (await provider.exists(storageKey) || await provider.exists(directStorageKey)) throw new Error('Test object remained after delete.');
  console.log(JSON.stringify({ passed: true, bucket, endpointHost: new URL(endpoint).host, verified: ['head-bucket', 'put', 'get', 'signed-read', 'signed-write', 'delete'] }, null, 2));
} finally {
  try { await provider.delete(storageKey); } catch { /* best-effort cleanup */ }
  try { await provider.delete(directStorageKey); } catch { /* best-effort cleanup */ }
}
