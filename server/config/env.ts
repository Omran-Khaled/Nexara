import dotenv from 'dotenv';

dotenv.config();

export type BookStorageProviderName = 'local' | 's3';
export type AuthProviderName = 'supabase' | 'local';

export interface BookStorageConfig {
  provider: BookStorageProviderName;
  bucket: string | null;
  endpoint: string | null;
  region: string;
  accessKeyId: string | null;
  secretAccessKey: string | null;
  localRoot: string;
}

export interface ServerConfig {
  port: number;
  nodeEnv: 'development' | 'test' | 'production';
  mongoUri: string | null;
  mongoDbName: string;
  supabaseUrl: string | null;
  supabasePublishableKey: string | null;
  /** development: 'local' password auth against MongoDB; production: always 'supabase'. */
  authProvider: AuthProviderName;
  /** Development-only bootstrap pair; both values must be provided together or not at all. */
  localAdminEmail: string | null;
  localAdminPassword: string | null;
  localSessionTtlHours: number;
  corsOrigins: string[];
  trustProxyHops: number;
  startupReadinessRequired: boolean;
  bookUploadMaxBytes: number;
  bookSignedUrlTtlSeconds: number;
  bookMalwareScanner: 'clamdscan' | 'remote-http' | null;
  requireMalwareScan: boolean;
  remoteMalwareScannerUrl: string | null;
  remoteMalwareScannerToken: string | null;
  bookStorage: BookStorageConfig;
}

function optional(value: string | undefined): string | null {
  return value && value.trim() ? value.trim() : null;
}

function csv(value: string | undefined): string[] {
  return (value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number, name: string): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  return parsed;
}

function boolean(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new Error('Boolean environment values must be exactly true or false.');
}

function url(value: string | null, name: string): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('unsupported protocol');
    return parsed.toString().replace(/\/$/, '');
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) URL.`);
  }
}

function storageConfig(env: NodeJS.ProcessEnv): BookStorageConfig {
  const requestedProvider = optional(env.BOOK_STORAGE_PROVIDER)?.toLowerCase() || 'local';
  if (requestedProvider !== 'local' && requestedProvider !== 's3') {
    throw new Error('BOOK_STORAGE_PROVIDER must be either local or s3.');
  }
  const provider = requestedProvider as BookStorageProviderName;
  const config: BookStorageConfig = {
    provider,
    bucket: optional(env.BOOK_STORAGE_BUCKET),
    endpoint: url(optional(env.BOOK_STORAGE_ENDPOINT), 'BOOK_STORAGE_ENDPOINT'),
    region: optional(env.BOOK_STORAGE_REGION) || 'auto',
    accessKeyId: optional(env.BOOK_STORAGE_ACCESS_KEY),
    secretAccessKey: optional(env.BOOK_STORAGE_SECRET_KEY),
    localRoot: optional(env.BOOK_STORAGE_LOCAL_ROOT) || '.data/book-files',
  };
  if (provider === 's3') {
    const missing = [
      ['BOOK_STORAGE_BUCKET', config.bucket],
      ['BOOK_STORAGE_ENDPOINT', config.endpoint],
      ['BOOK_STORAGE_ACCESS_KEY', config.accessKeyId],
      ['BOOK_STORAGE_SECRET_KEY', config.secretAccessKey],
    ].filter(([, value]) => !value).map(([name]) => name);
    if (missing.length) throw new Error(`S3-compatible storage is incomplete; missing ${missing.join(', ')}.`);
  }
  return config;
}

export function loadServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const rawNodeEnv = env.NODE_ENV || 'development';
  if (rawNodeEnv !== 'development' && rawNodeEnv !== 'test' && rawNodeEnv !== 'production') {
    throw new Error('NODE_ENV must be development, test, or production.');
  }
  const nodeEnv = rawNodeEnv;
  const bookUploadMaxBytes = boundedInteger(env.BOOK_STORAGE_MAX_BYTES, 100 * 1024 * 1024, 1, 100 * 1024 * 1024, 'BOOK_STORAGE_MAX_BYTES');
  const bookSignedUrlTtlSeconds = boundedInteger(env.BOOK_STORAGE_SIGNED_URL_TTL_SECONDS, 300, 1, 3600, 'BOOK_STORAGE_SIGNED_URL_TTL_SECONDS');
  const configuredScanner = optional(env.BOOK_MALWARE_SCANNER)?.toLowerCase() || null;
  if (configuredScanner && configuredScanner !== 'clamdscan' && configuredScanner !== 'remote-http') {
    throw new Error('BOOK_MALWARE_SCANNER must be clamdscan or remote-http when configured.');
  }
  const requireMalwareScan = boolean(env.BOOK_REQUIRE_MALWARE_SCAN);
  const remoteMalwareScannerUrl = url(optional(env.BOOK_MALWARE_SCANNER_URL), 'BOOK_MALWARE_SCANNER_URL');
  const remoteMalwareScannerToken = optional(env.BOOK_MALWARE_SCANNER_TOKEN);
  if (requireMalwareScan && !configuredScanner) {
    throw new Error('BOOK_REQUIRE_MALWARE_SCAN=true requires a configured BOOK_MALWARE_SCANNER.');
  }
  if (configuredScanner === 'remote-http' && !remoteMalwareScannerUrl) {
    throw new Error('BOOK_MALWARE_SCANNER=remote-http requires BOOK_MALWARE_SCANNER_URL.');
  }
  if (nodeEnv === 'production' && configuredScanner === 'remote-http' && remoteMalwareScannerUrl && new URL(remoteMalwareScannerUrl).protocol !== 'https:') {
    throw new Error('BOOK_MALWARE_SCANNER_URL must use HTTPS when NODE_ENV=production.');
  }

  // Prefer paired Vite values when present so client and server cannot silently target different projects.
  const supabaseUrl = url(optional(env.VITE_SUPABASE_URL || env.SUPABASE_URL), 'SUPABASE_URL');
  const supabasePublishableKey = optional(env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY);
  if (nodeEnv === 'production' && (!supabaseUrl || !supabasePublishableKey)) {
    throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required when NODE_ENV=production.');
  }

  // --- Authentication provider boundary -------------------------------------
  // DEVELOPMENT may select AUTH_PROVIDER=local (password accounts in MongoDB).
  // PRODUCTION is always Supabase Auth; an accidental local configuration must
  // never start, and there are no silent fallbacks in either direction.
  const requestedAuthProvider = optional(env.AUTH_PROVIDER)?.toLowerCase() || 'supabase';
  if (requestedAuthProvider !== 'supabase' && requestedAuthProvider !== 'local') {
    throw new Error('AUTH_PROVIDER must be either supabase or local.');
  }
  const authProvider = requestedAuthProvider as AuthProviderName;
  if (nodeEnv === 'production' && authProvider === 'local') {
    throw new Error('AUTH_PROVIDER=local is rejected when NODE_ENV=production; production requires Supabase Auth.');
  }
  const localAdminEmail = optional(env.NEXARA_LOCAL_ADMIN_EMAIL)?.toLowerCase() || null;
  const localAdminPassword = optional(env.NEXARA_LOCAL_ADMIN_PASSWORD);
  if (!localAdminEmail !== !localAdminPassword) {
    throw new Error('NEXARA_LOCAL_ADMIN_EMAIL and NEXARA_LOCAL_ADMIN_PASSWORD must be provided together or not at all.');
  }
  if (localAdminPassword && localAdminPassword.length < 10) {
    throw new Error('NEXARA_LOCAL_ADMIN_PASSWORD must contain at least 10 characters.');
  }
  if ((localAdminEmail || localAdminPassword) && authProvider !== 'local') {
    throw new Error('NEXARA_LOCAL_ADMIN_* variables apply only when AUTH_PROVIDER=local.');
  }
  const localSessionTtlHours = boundedInteger(env.NEXARA_LOCAL_SESSION_TTL_HOURS, 168, 1, 720, 'NEXARA_LOCAL_SESSION_TTL_HOURS');

  const corsOrigins = csv(env.NEXARA_CORS_ORIGINS);
  const allowInsecureLoopback = boolean(env.NEXARA_ALLOW_INSECURE_LOOPBACK);
  if (nodeEnv === 'production' && corsOrigins.length === 0) {
    throw new Error('NEXARA_CORS_ORIGINS must contain one or more exact HTTPS origins when NODE_ENV=production.');
  }
  for (const origin of corsOrigins) {
    const parsed = url(origin, 'NEXARA_CORS_ORIGINS');
    const parsedUrl = parsed ? new URL(parsed) : null;
    if (!parsed || !parsedUrl || parsedUrl.origin !== parsed) {
      throw new Error('Each NEXARA_CORS_ORIGINS entry must be an exact origin without a path, query, or fragment.');
    }
    const isLoopback = parsedUrl.hostname === '127.0.0.1' || parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '[::1]';
    if (nodeEnv === 'production' && parsedUrl.protocol !== 'https:' && !(allowInsecureLoopback && isLoopback)) {
      throw new Error('NEXARA_CORS_ORIGINS entries must use HTTPS when NODE_ENV=production.');
    }
  }

  const bookStorage = storageConfig(env);
  const trustProxyHops = boundedInteger(env.NEXARA_TRUST_PROXY_HOPS, nodeEnv === 'production' ? 1 : 0, 0, 10, 'NEXARA_TRUST_PROXY_HOPS');
  const startupReadinessRequired = boolean(env.NEXARA_STARTUP_READINESS_REQUIRED);

  return {
    port,
    nodeEnv,
    mongoUri: optional(env.MONGODB_URI || env.MONGO_URI),
    mongoDbName: env.MONGODB_DB_NAME || env.MONGO_DB_NAME || 'nexara',
    supabaseUrl,
    supabasePublishableKey,
    authProvider,
    localAdminEmail,
    localAdminPassword,
    localSessionTtlHours,
    corsOrigins,
    trustProxyHops,
    startupReadinessRequired,
    bookUploadMaxBytes,
    bookSignedUrlTtlSeconds,
    bookMalwareScanner: configuredScanner as 'clamdscan' | 'remote-http' | null,
    requireMalwareScan,
    remoteMalwareScannerUrl,
    remoteMalwareScannerToken,
    bookStorage,
  };
}
