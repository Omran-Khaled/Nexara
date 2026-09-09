import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { STANDARD_EBOOKS_LAUNCH_MANIFEST, InitialCatalogIngestor, summarizeCatalogResults } from '../server/catalog/InitialCatalogIngestion';
import { ClamDScanMalwareScanner, UploadSecurityInspector } from '../server/security/FileUploadSecurity';
import { LocalStorageProvider, S3CompatibleStorageProvider, StorageProvider } from '../server/storage/StorageProvider';

function required(name: string): string { const value = process.env[name]?.trim(); if (!value) throw new Error(`${name} is required for catalog:ingest.`); return value; }
function optionalBoolean(value: string | undefined): boolean { return value?.trim().toLowerCase() === 'true'; }
function boundedBytes(value: string | undefined): number {
  if (!value?.trim()) return 25 * 1024 * 1024;
  const parsed = Number(value); if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 100 * 1024 * 1024) throw new Error('BOOK_STORAGE_MAX_BYTES must be an integer between 1 and 104857600.');
  return parsed;
}
function storage(): StorageProvider {
  const mode = process.env.BOOK_STORAGE_PROVIDER?.trim().toLowerCase() || 'local';
  if (mode === 's3') return new S3CompatibleStorageProvider({ bucket: required('BOOK_STORAGE_BUCKET'), endpoint: required('BOOK_STORAGE_ENDPOINT'), region: process.env.BOOK_STORAGE_REGION?.trim() || 'auto', accessKeyId: required('BOOK_STORAGE_ACCESS_KEY'), secretAccessKey: required('BOOK_STORAGE_SECRET_KEY') });
  if (mode === 'local' && process.env.NODE_ENV !== 'production') return new LocalStorageProvider(process.env.BOOK_STORAGE_LOCAL_ROOT?.trim() || '.data/book-files');
  throw new Error('Production catalog ingestion requires BOOK_STORAGE_PROVIDER=s3 with durable S3-compatible object storage. Local storage is development/test only.');
}

const dryRun = process.argv.includes('--dry-run');
const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
const databaseName = process.env.MONGODB_DB_NAME || process.env.MONGO_DB_NAME || 'nexara';
if (!uri) throw new Error('MONGODB_URI (or MONGO_URI) is required for catalog:ingest.');

const scannerName = process.env.BOOK_MALWARE_SCANNER?.trim().toLowerCase();
if (scannerName && scannerName !== 'clamdscan') throw new Error('BOOK_MALWARE_SCANNER must be clamdscan when configured.');
const inspector = new UploadSecurityInspector({ maxBytes: boundedBytes(process.env.BOOK_STORAGE_MAX_BYTES), malwareScanner: scannerName === 'clamdscan' ? new ClamDScanMalwareScanner() : null, requireMalwareScan: optionalBoolean(process.env.BOOK_REQUIRE_MALWARE_SCAN) });
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });

try {
  await client.connect();
  if (optionalBoolean(process.env.BOOK_REQUIRE_MALWARE_SCAN)) await inspector.checkHealth();
  const ingestor = new InitialCatalogIngestor(client.db(databaseName), storage(), { inspector });
  const results = await ingestor.run(STANDARD_EBOOKS_LAUNCH_MANIFEST, { dryRun, delayMs: 1_500 });
  const summary = summarizeCatalogResults(results);
  console.log(JSON.stringify({ command: 'catalog:ingest', dryRun, database: databaseName, source: 'Standard Ebooks', ...summary }, null, 2));
  if (summary.rejected) process.exitCode = 2;
} finally {
  await client.close();
}
