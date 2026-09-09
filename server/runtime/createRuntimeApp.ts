import type { Express } from 'express';
import { MongoDatabase } from '../db/mongoClient';
import { applyP15CatalogMigration } from '../db/migrations';
import { loadServerConfig } from '../config/env';
import { MongoBookRepository } from '../repositories/MongoBookRepository';
import { MongoAuditLogRepository, MongoBookmarkRepository, MongoCollectionRepository, MongoHighlightRepository, MongoReadingHistoryRepository, MongoReadingProgressRepository, MongoReviewRepository, MongoRightsRepository } from '../repositories/LibraryRepositories';
import { MongoRuntimeRepository } from '../repositories/RuntimeRepositories';
import { MongoIngestionRepository } from '../repositories/IngestionRepositories';
import { MongoCatalogRepository } from '../repositories/CatalogRepository';
import { BookService } from '../services/BookService';
import { AuditService, RightsService } from '../services/LibraryServices';
import { GutenbergIngestionSourceGateway, IngestionService, MongoIngestionPublisher } from '../services/IngestionService';
import { createApp } from '../createApp';
import { DiscoveryService } from '../discovery/DiscoveryService';
import { OpenLibraryProvider } from '../discovery/OpenLibraryProvider';
import { GutenbergProvider } from '../discovery/GutenbergProvider';
import { WikisourceProvider } from '../discovery/WikisourceProvider';
import { ArabicCollectionsOnlineProvider } from '../discovery/ArabicCollectionsOnlineProvider';
import { MongoBookFileRepository } from '../storage/MongoBookFileRepository';
import { BookFileService } from '../services/BookFileService';
import { LocalStorageProvider, S3CompatibleStorageProvider } from '../storage/StorageProvider';
import { MongoAuthorizationRepository } from '../auth/AuthorizationRepository';
import { LocalAuthenticationService } from '../auth/LocalAuthenticationService';
import { ClamDScanMalwareScanner, HttpMalwareScanner, UploadSecurityInspector } from '../security/FileUploadSecurity';
import { OperationalHealth } from '../observability/health';
import { logEvent } from '../observability/logger';
import { LocalAuthController } from '../controllers/LocalAuthController';
import { createLocalAuthRoutes } from '../routes/localAuthRoutes';

let runtimeApp: Promise<Express> | null = null;
let runtimeMongo: MongoDatabase | null = null;

async function createConfiguredApp(): Promise<Express> {
  const config = loadServerConfig();
  if (!config.mongoUri) throw new Error('MONGODB_URI (or MONGO_URI) is required. Nexara will not start without durable runtime data.');
  runtimeMongo ||= new MongoDatabase(config.mongoUri, config.mongoDbName);
  const db = await runtimeMongo.connect();

  // Schema migrations are a controlled deployment job. They are intentionally disabled by default
  // in serverless request runtimes to prevent concurrent cold starts from changing the schema.
  if (process.env.NEXARA_APPLY_MIGRATIONS_ON_STARTUP === 'true') await applyP15CatalogMigration(db);

  const authorizationRepository = new MongoAuthorizationRepository(db);
  const bookRepository = new MongoBookRepository(db);
  const rightsRepository = new MongoRightsRepository(db);
  const auditRepository = new MongoAuditLogRepository(db);
  const discoveryService = new DiscoveryService([new OpenLibraryProvider(), new GutenbergProvider(), new WikisourceProvider(), new ArabicCollectionsOnlineProvider()]);
  const fileRepository = new MongoBookFileRepository(db);
  const storageProvider = config.bookStorage.provider === 's3'
    ? new S3CompatibleStorageProvider({
      bucket: config.bookStorage.bucket || '',
      endpoint: config.bookStorage.endpoint || '',
      region: config.bookStorage.region,
      accessKeyId: config.bookStorage.accessKeyId || '',
      secretAccessKey: config.bookStorage.secretAccessKey || '',
    })
    : new LocalStorageProvider(config.bookStorage.localRoot);
  if (config.nodeEnv === 'production' && storageProvider.name !== 's3-compatible') {
    throw new Error('Production requires BOOK_STORAGE_PROVIDER=s3; local book storage is not allowed.');
  }

  const malwareScanner = config.bookMalwareScanner === 'clamdscan'
    ? new ClamDScanMalwareScanner()
    : config.bookMalwareScanner === 'remote-http'
      ? new HttpMalwareScanner(config.remoteMalwareScannerUrl || '', config.remoteMalwareScannerToken)
      : null;
  const uploadSecurity = new UploadSecurityInspector({
    maxBytes: config.bookUploadMaxBytes,
    malwareScanner,
    requireMalwareScan: config.requireMalwareScan,
  });
  const fileService = new BookFileService(fileRepository, storageProvider, () => Date.now(), uploadSecurity, config.bookUploadMaxBytes);
  // --- Local development authentication (AUTH_PROVIDER=local) ---------------
  // Password accounts and sessions live in MongoDB; roles keep resolving through
  // the same MongoAuthorizationRepository. Production never constructs this
  // service: env.ts rejects the configuration outright.
  const localAuth = config.authProvider === 'local' ? new LocalAuthenticationService(db, config.localSessionTtlHours) : null;
  if (localAuth) {
    await localAuth.ensureIndexes();
    if (config.localAdminEmail && config.localAdminPassword) {
      const existing = await localAuth.findByEmail(config.localAdminEmail);
      const account = existing || await localAuth.register({
        email: config.localAdminEmail,
        password: config.localAdminPassword,
        displayName: 'Nexara Admin',
        displayNameAr: 'مدير Nexara',
      });
      const currentRoles = await authorizationRepository.rolesForUser(account.id);
      if (!currentRoles.includes('ADMIN')) {
        await authorizationRepository.assignRole({ userId: account.id, role: 'ADMIN', assignedBy: 'system:local-bootstrap' });
      }
      logEvent('info', 'local_admin_bootstrap_ready', { provider: 'local-auth', outcome: 'ready' });
    }
  }
  const ingestionService = new IngestionService(
    new MongoIngestionRepository(db),
    new GutenbergIngestionSourceGateway(),
    new MongoIngestionPublisher(new MongoCatalogRepository(db)),
    new BookService(bookRepository),
    new RightsService(bookRepository, rightsRepository, new AuditService(auditRepository)),
    fileService,
  );
  const checkSupabaseAuth = async () => {
    if (!config.supabaseUrl || !config.supabasePublishableKey) throw new Error('Supabase authentication configuration is unavailable.');
    const response = await fetch(`${config.supabaseUrl}/auth/v1/settings`, { headers: { apikey: config.supabasePublishableKey }, signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error('Supabase authentication dependency did not return success.');
  };
  const health = new OperationalHealth([
    { name: 'mongodb', required: true, check: () => runtimeMongo!.ping() },
    { name: 'file-storage', required: true, check: async () => { if (!storageProvider.checkHealth) throw new Error('Storage provider has no health check.'); await storageProvider.checkHealth(); } },
    { name: 'supabase-auth', required: config.nodeEnv === 'production', check: checkSupabaseAuth },
    { name: 'malware-scanner', required: config.requireMalwareScan, check: () => uploadSecurity.checkHealth() },
  ]);
  if (config.startupReadinessRequired) {
    const report = await health.ready();
    if (!report.ready) {
      const failed = report.dependencies.filter((dependency) => dependency.required && dependency.status === 'failed').map((dependency) => dependency.name);
      throw new Error(`Startup readiness validation failed for: ${failed.join(', ') || 'an unknown required dependency'}.`);
    }
  }

  const app = createApp({
    bookRepository,
    progressRepository: new MongoReadingProgressRepository(db),
    historyRepository: new MongoReadingHistoryRepository(db),
    bookmarkRepository: new MongoBookmarkRepository(db),
    highlightRepository: new MongoHighlightRepository(db),
    collectionRepository: new MongoCollectionRepository(db),
    reviewRepository: new MongoReviewRepository(db),
    rightsRepository,
    auditRepository,
    runtimeRepository: new MongoRuntimeRepository(db),
    ingestionService,
    discoveryService,
    auth: {
      supabaseUrl: config.supabaseUrl,
      supabasePublishableKey: config.supabasePublishableKey,
      authProvider: config.authProvider,
      localSessions: localAuth || undefined,
      roleResolver: authorizationRepository,
      allowTestIdentity: false,
    },
    security: { nodeEnv: config.nodeEnv, corsOrigins: config.corsOrigins },
    authorizationRepository,
    fileRepository,
    storageProvider,
    fileService,
    uploadSecurity,
    health,
    fileAccessUrlMaxSeconds: config.bookSignedUrlTtlSeconds,
    bookUploadMaxBytes: config.bookUploadMaxBytes,
  });
  if (config.trustProxyHops > 0) app.set('trust proxy', config.trustProxyHops);

  app.get('/api/supabase/status', async (_req, res) => {
    if (!config.supabaseUrl || !config.supabasePublishableKey) {
      res.status(503).json({ configured: false, connected: false, checkedAt: new Date().toISOString(), message: 'Supabase is not configured on this server. No cloud connection was verified.' });
      return;
    }
    const startedAt = Date.now();
    try {
      await checkSupabaseAuth();
      res.status(200).json({ configured: true, connected: true, checkedAt: new Date().toISOString(), latencyMs: Date.now() - startedAt, message: 'Supabase responded successfully to a live server-side check.' });
    } catch (error) {
      res.status(503).json({ configured: true, connected: false, checkedAt: new Date().toISOString(), latencyMs: Date.now() - startedAt, message: `Supabase connection check failed: ${error instanceof Error ? error.message : 'Unknown network error'}` });
    }
  });
  // Local development auth routes exist only when the local provider is selected;
  // the production runtime never mounts them.
  if (localAuth) {
    app.use('/api', createLocalAuthRoutes(new LocalAuthController(localAuth)));
  }
  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API route not found.' } }));
  return app;
}

export function getRuntimeApp(): Promise<Express> {
  runtimeApp ||= createConfiguredApp();
  return runtimeApp;
}

export async function closeRuntimeApp(): Promise<void> {
  await runtimeMongo?.close();
  runtimeMongo = null;
  runtimeApp = null;
}
