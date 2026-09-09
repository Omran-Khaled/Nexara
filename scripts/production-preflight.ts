import { MongoClient } from 'mongodb';
import { loadServerConfig } from '../server/config/env';
import { S3CompatibleStorageProvider } from '../server/storage/StorageProvider';
import { ClamDScanMalwareScanner, UploadSecurityInspector } from '../server/security/FileUploadSecurity';

type CheckResult = { name: string; status: 'ok' | 'failed'; latencyMs: number; detail?: string };

const config = loadServerConfig();

function required(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function check(name: string, run: () => Promise<void>): Promise<CheckResult> {
  const startedAt = Date.now();
  try {
    await run();
    return { name, status: 'ok', latencyMs: Date.now() - startedAt };
  } catch (error) {
    return { name, status: 'failed', latencyMs: Date.now() - startedAt, detail: error instanceof Error ? error.message.slice(0, 300) : 'Unknown error' };
  }
}

required(config.nodeEnv === 'production', 'Production preflight requires NODE_ENV=production.');
required(config.mongoUri, 'Production preflight requires MONGODB_URI.');
required(config.bookStorage.provider === 's3', 'Production preflight requires BOOK_STORAGE_PROVIDER=s3.');
required(config.requireMalwareScan && config.bookMalwareScanner === 'clamdscan', 'Production preflight requires active ClamAV scanning.');
required(config.startupReadinessRequired, 'Production preflight requires NEXARA_STARTUP_READINESS_REQUIRED=true.');
required(config.corsOrigins.every((origin) => new URL(origin).protocol === 'https:'), 'Production CORS origins must all use HTTPS.');

const mongo = new MongoClient(config.mongoUri, { serverSelectionTimeoutMS: 8_000 });
const storage = new S3CompatibleStorageProvider({
  bucket: config.bookStorage.bucket || '',
  endpoint: config.bookStorage.endpoint || '',
  region: config.bookStorage.region,
  accessKeyId: config.bookStorage.accessKeyId || '',
  secretAccessKey: config.bookStorage.secretAccessKey || '',
});
const uploadSecurity = new UploadSecurityInspector({
  maxBytes: config.bookUploadMaxBytes,
  malwareScanner: new ClamDScanMalwareScanner(),
  requireMalwareScan: true,
});

const checks = await Promise.all([
  check('mongodb', async () => { await mongo.connect(); await mongo.db(config.mongoDbName).command({ ping: 1 }); }),
  check('object-storage', () => storage.checkHealth()),
  check('supabase-auth', async () => {
    const response = await fetch(`${config.supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: config.supabasePublishableKey || '' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Supabase responded with HTTP ${response.status}.`);
  }),
  check('malware-scanner', () => uploadSecurity.checkHealth()),
]);
await mongo.close().catch(() => undefined);

const report = {
  checkedAt: new Date().toISOString(),
  environment: config.nodeEnv,
  checks,
  passed: checks.every((item) => item.status === 'ok'),
};
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
