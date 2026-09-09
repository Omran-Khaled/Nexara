import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface StoredObject { storageKey: string; sizeBytes: number; checksum: string; mimeType: string; }
export interface StorageProvider {
  readonly name: string;
  put(input: { storageKey: string; body: Readable | Buffer; mimeType: string; expectedChecksum?: string }): Promise<StoredObject>;
  get(storageKey: string): Promise<{ stream: Readable; sizeBytes: number; checksum: string; mimeType: string }>;
  exists(storageKey: string): Promise<boolean>;
  delete(storageKey: string): Promise<void>;
  signedReadUrl(storageKey: string, expiresInSeconds: number): Promise<string>;
  /** Available on durable object storage; used to bypass serverless request-body limits safely. */
  signedWriteUrl?(storageKey: string, mimeType: string, expiresInSeconds: number): Promise<string>;
  /** Performs a non-mutating provider connectivity check when implemented. */
  checkHealth?(): Promise<void>;
}
function safeKey(key: string): string { if (!/^[A-Za-z0-9][A-Za-z0-9._\/-]{0,500}$/.test(key) || key.includes('..')) throw new Error('Invalid storage key.'); return key; }
async function bufferBody(body: Readable | Buffer): Promise<Buffer> { if (Buffer.isBuffer(body)) return body; const chunks: Buffer[] = []; for await (const chunk of body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); return Buffer.concat(chunks); }
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local-test';
  constructor(private readonly root: string) {}
  async put(input: { storageKey: string; body: Readable | Buffer; mimeType: string; expectedChecksum?: string }): Promise<StoredObject> { const key = safeKey(input.storageKey); const body = await bufferBody(input.body); const checksum = createHash('sha256').update(body).digest('hex'); if (input.expectedChecksum && input.expectedChecksum !== checksum) throw new Error('Checksum mismatch.'); const path = join(this.root, key); await fs.mkdir(dirname(path), { recursive: true }); await fs.writeFile(path, body); await fs.writeFile(`${path}.meta.json`, JSON.stringify({ sizeBytes: body.length, checksum, mimeType: input.mimeType })); return { storageKey: key, sizeBytes: body.length, checksum, mimeType: input.mimeType }; }
  async get(storageKey: string) { const key = safeKey(storageKey); const path = join(this.root, key); const meta = JSON.parse(await fs.readFile(`${path}.meta.json`, 'utf8')); const body = await fs.readFile(path); return { stream: Readable.from(body), sizeBytes: body.length, checksum: createHash('sha256').update(body).digest('hex'), mimeType: meta.mimeType }; }
  async exists(storageKey: string) { try { await fs.access(join(this.root, safeKey(storageKey))); return true; } catch { return false; } }
  async delete(storageKey: string) { const path = join(this.root, safeKey(storageKey)); await fs.rm(path, { force: true }); await fs.rm(`${path}.meta.json`, { force: true }); }
  async signedReadUrl(storageKey: string, expiresInSeconds: number) { return `local://${safeKey(storageKey)}?expires=${Date.now() + expiresInSeconds * 1000}&token=${randomUUID()}`; }
  async checkHealth() { await fs.mkdir(this.root, { recursive: true }); await fs.access(this.root); }
}
export class S3CompatibleStorageProvider implements StorageProvider {
  readonly name = 's3-compatible'; private readonly client: S3Client;
  constructor(private readonly config: { bucket: string; endpoint: string; region: string; accessKeyId: string; secretAccessKey: string }) { this.client = new S3Client({ region: config.region, endpoint: config.endpoint, forcePathStyle: true, credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } }); }
  async put(input: { storageKey: string; body: Readable | Buffer; mimeType: string; expectedChecksum?: string }) { const key = safeKey(input.storageKey); const body = await bufferBody(input.body); const checksum = createHash('sha256').update(body).digest('hex'); if (input.expectedChecksum && input.expectedChecksum !== checksum) throw new Error('Checksum mismatch.'); await this.client.send(new PutObjectCommand({ Bucket: this.config.bucket, Key: key, Body: body, ContentType: input.mimeType, ContentLength: body.length, Metadata: { sha256: checksum } })); return { storageKey: key, sizeBytes: body.length, checksum, mimeType: input.mimeType }; }
  async get(storageKey: string) { const key = safeKey(storageKey); const result = await this.client.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: key })); if (!result.Body) throw new Error('Object body is missing.'); return { stream: result.Body as Readable, sizeBytes: Number(result.ContentLength || 0), checksum: result.Metadata?.sha256 || '', mimeType: result.ContentType || 'application/octet-stream' }; }
  async exists(storageKey: string) { try { await this.client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: safeKey(storageKey) })); return true; } catch { return false; } }
  async delete(storageKey: string) { await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: safeKey(storageKey) })); }
  async signedReadUrl(storageKey: string, expiresInSeconds: number) { if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > 3600) throw new Error('Invalid signed URL expiry.'); return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.config.bucket, Key: safeKey(storageKey) }), { expiresIn: expiresInSeconds }); }
  async signedWriteUrl(storageKey: string, mimeType: string, expiresInSeconds: number) { if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > 900) throw new Error('Invalid signed upload URL expiry.'); return getSignedUrl(this.client, new PutObjectCommand({ Bucket: this.config.bucket, Key: safeKey(storageKey), ContentType: mimeType }), { expiresIn: expiresInSeconds }); }
  async checkHealth() { await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket })); }
}
export function makeStorageKey(bookId: string, editionId: string, fileId: string = randomUUID()): string { return `books/${bookId}/editions/${editionId}/files/${fileId}`; }
export function checksumOf(data: Buffer): string { return createHash('sha256').update(data).digest('hex'); }
export { Readable };
