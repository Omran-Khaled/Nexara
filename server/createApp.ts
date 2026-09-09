import express, { Express, RequestHandler } from "express";
import { BookController } from "./controllers/BookController";
import {
  AuditLogController,
  BookmarkController,
  CollectionController,
  HighlightController,
  ReadingProgressController,
  ReviewController,
  RightsController,
} from "./controllers/LibraryControllers";
import { errorHandler } from "./middleware/errorHandler";
import {
  AuditLogRepository,
  BookmarkRepository,
  CollectionRepository,
  HighlightRepository,
  InMemoryReadingHistoryRepository,
  ReadingHistoryRepository,
  ReadingProgressRepository,
  ReviewRepository,
  RightsRepository,
} from "./repositories/LibraryRepositories";
import { BookRepository } from "./repositories/BookRepository";
import { createBookRoutes } from "./routes/bookRoutes";
import { createLibraryRoutes } from "./routes/libraryRoutes";
import { BookService } from "./services/BookService";
import {
  AuditService,
  BookmarkService,
  CollectionService,
  HighlightService,
  ReadingService,
  ReviewService,
  RightsService,
} from "./services/LibraryServices";
import { DiscoveryService } from "./discovery/DiscoveryService";
import { DiscoveryController } from "./discovery/DiscoveryController";
import { createDiscoveryRoutes } from "./discovery/discoveryRoutes";
import { GutenbergDownloadController } from "./discovery/GutenbergDownloadController";
import { GutenbergDownloadService } from "./discovery/GutenbergDownloadService";
import { AuthOptions, createAuthMiddleware } from "./middleware/auth";
import {
  csrfOriginGuard,
  SecurityOptions,
  rateLimit,
  securityHeaders,
  strictCors,
} from "./middleware/security";
import { RuntimeRepository } from "./repositories/RuntimeRepositories";
import { RuntimeService } from "./services/RuntimeServices";
import { RuntimeController } from "./controllers/RuntimeControllers";
import { createRuntimeRoutes } from "./routes/runtimeRoutes";
import { IngestionService } from "./services/IngestionService";
import { IngestionController } from "./controllers/IngestionController";
import { createIngestionRoutes } from "./routes/ingestionRoutes";
import { BookFileService } from "./services/BookFileService";
import { BookFileController } from "./controllers/BookFileController";
import { createBookFileRoutes } from "./routes/bookFileRoutes";
import {
  BookFileRepository,
  MemoryBookFileRepository,
} from "./storage/BookFileRepository";
import {
  LocalStorageProvider,
  StorageProvider,
} from "./storage/StorageProvider";
import { join } from "node:path";
import { DownloadController } from "./controllers/DownloadController";
import { createDownloadRoutes } from "./routes/downloadRoutes";
import { DownloadService } from "./services/DownloadService";
import { requestReliability } from "./middleware/requestReliability";
import {
  AuthorizationRepository,
  InMemoryAuthorizationRepository,
} from "./auth/AuthorizationRepository";
import { AuthorizationController } from "./controllers/AuthorizationController";
import { createAuthorizationRoutes } from "./routes/authorizationRoutes";
import { UploadSecurityInspector } from "./security/FileUploadSecurity";
import { OperationalHealth } from "./observability/health";
import { logEvent } from "./observability/logger";

export interface AppDependencies {
  bookRepository: BookRepository;
  progressRepository: ReadingProgressRepository;
  historyRepository?: ReadingHistoryRepository;
  bookmarkRepository: BookmarkRepository;
  highlightRepository: HighlightRepository;
  collectionRepository: CollectionRepository;
  reviewRepository: ReviewRepository;
  rightsRepository: RightsRepository;
  auditRepository: AuditLogRepository;
  discoveryService?: DiscoveryService;
  auth?: AuthOptions;
  security?: SecurityOptions;
  /** Present in the real server runtime; omitted only by narrow unit tests that construct createApp directly. */
  runtimeRepository?: RuntimeRepository;
  /** Enabled by the real server only after MongoDB migration is available. */
  ingestionService?: IngestionService;
  fileRepository?: BookFileRepository;
  storageProvider?: StorageProvider;
  /** Shared with the reviewed ingestion service in the durable runtime. */
  fileService?: BookFileService;
  authorizationRepository?: AuthorizationRepository;
  uploadSecurity?: UploadSecurityInspector;
  /** Default and maximum lifetime for a read access URL. */
  fileAccessUrlMaxSeconds?: number;
  /** Upload policy ceiling shared by the file service and staged-body controller. */
  bookUploadMaxBytes?: number;
  /** Real-server readiness dependency checks; tests may rely on the explicit empty default. */
  health?: OperationalHealth;
}

export function createApp(dependencies: AppDependencies): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    "/api/books",
    express.raw({
      type: [
        "application/octet-stream",
        "application/pdf",
        "application/epub+zip",
        "text/plain",
        "text/html",
        "application/xhtml+xml",
      ],
      limit: "100mb",
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  const security = dependencies.security || { nodeEnv: "test" };
  app.use(securityHeaders(security));
  app.use(strictCors(security));
  app.use(csrfOriginGuard(security));
  app.use(rateLimit(security));
  app.use(requestReliability());
  const authorizationRepository =
    dependencies.authorizationRepository ||
    new InMemoryAuthorizationRepository();
  app.use(
    createAuthMiddleware({
      supabaseUrl: null,
      supabasePublishableKey: null,
      allowTestIdentity: true,
      testRole: "ADMIN",
      ...(dependencies.auth || {}),
      roleResolver: dependencies.auth?.roleResolver || authorizationRepository,
    }),
  );
  const health = dependencies.health || new OperationalHealth([]);
  app.get("/api/health/live", (req, res) => {
    const report = health.live();
    logEvent("info", "health_liveness", {
      ...(req.reliability?.requestId
        ? { requestId: req.reliability.requestId }
        : {}),
      route: "/api/health/live",
      statusCode: 200,
      outcome: "live",
    });
    res.status(200).json({ ...report, service: "Nexara Digital Library" });
  });
  const readinessHandler: RequestHandler = async (req, res) => {
    const report = await health.ready();
    const statusCode = report.ready ? 200 : 503;
    for (const dependency of report.dependencies.filter(
      (item) => item.required && item.status === "failed",
    )) {
      logEvent(
        "error",
        dependency.name === "mongodb"
          ? "database_error"
          : "dependency_unavailable",
        {
          ...(req.reliability?.requestId
            ? { requestId: req.reliability.requestId }
            : {}),
          route: req.path,
          statusCode,
          dependency: dependency.name,
          provider: dependency.name === "mongodb" ? "mongodb" : undefined,
          outcome: "readiness_failed",
        },
      );
    }
    logEvent(report.ready ? "info" : "error", "health_readiness", {
      ...(req.reliability?.requestId
        ? { requestId: req.reliability.requestId }
        : {}),
      route: req.path,
      statusCode,
      outcome: report.ready ? "ready" : "not_ready",
      dependencies: report.dependencies,
    });
    res
      .status(statusCode)
      .json({ ...report, service: "Nexara Digital Library" });
  };
  app.get("/api/health", readinessHandler);
  app.get("/api/health/ready", readinessHandler);

  const bookService = new BookService(dependencies.bookRepository);
  const auditService = new AuditService(dependencies.auditRepository);
  const progressService = new ReadingService(
    dependencies.bookRepository,
    dependencies.progressRepository,
    auditService,
    dependencies.historyRepository || new InMemoryReadingHistoryRepository(),
  );
  const bookmarkService = new BookmarkService(
    dependencies.bookRepository,
    dependencies.bookmarkRepository,
    auditService,
  );
  const highlightService = new HighlightService(
    dependencies.bookRepository,
    dependencies.highlightRepository,
    auditService,
  );
  const collectionService = new CollectionService(
    dependencies.bookRepository,
    dependencies.collectionRepository,
    auditService,
  );
  const reviewService = new ReviewService(
    dependencies.bookRepository,
    dependencies.reviewRepository,
    auditService,
  );
  const rightsService = new RightsService(
    dependencies.bookRepository,
    dependencies.rightsRepository,
    auditService,
  );
  const runtimeService = dependencies.runtimeRepository
    ? new RuntimeService(
        dependencies.runtimeRepository,
        dependencies.bookRepository,
      )
    : null;

  app.use(
    "/api",
    createAuthorizationRoutes(
      new AuthorizationController(authorizationRepository),
    ),
  );
  app.use("/api/books", createBookRoutes(new BookController(bookService)));
  const fileRepository =
    dependencies.fileRepository || new MemoryBookFileRepository();
  const storageProvider =
    dependencies.storageProvider ||
    new LocalStorageProvider(join(process.cwd(), ".data", "book-files"));
  const fileService =
    dependencies.fileService ||
    new BookFileService(
      fileRepository,
      storageProvider,
      () => Date.now(),
      dependencies.uploadSecurity,
    );
  // Runtime authentication explicitly disables test identity, so raw uploads cannot bypass the reviewed direct-upload contract.
  const allowRawUploadsForTests =
    dependencies.auth?.allowTestIdentity ?? !dependencies.auth;
  app.use(
    "/api",
    createBookFileRoutes(
      new BookFileController(
        fileService,
        rightsService,
        dependencies.fileAccessUrlMaxSeconds,
        allowRawUploadsForTests,
        dependencies.bookUploadMaxBytes,
        bookService,
      ),
    ),
  );
  app.use(
    "/api",
    createDownloadRoutes(
      new DownloadController(
        new DownloadService(
          dependencies.bookRepository,
          fileRepository,
          fileService,
          storageProvider,
          auditService,
        ),
      ),
    ),
  );
  app.use(
    "/api/discovery",
    createDiscoveryRoutes(
      new DiscoveryController(
        dependencies.discoveryService || new DiscoveryService([]),
      ),
      new GutenbergDownloadController(new GutenbergDownloadService()),
    ),
  );
  if (runtimeService)
    app.use("/api", createRuntimeRoutes(new RuntimeController(runtimeService)));
  if (dependencies.ingestionService)
    app.use(
      "/api/ingestions",
      createIngestionRoutes(
        new IngestionController(dependencies.ingestionService),
      ),
    );
  app.use(
    "/api",
    createLibraryRoutes({
      progress: new ReadingProgressController(progressService),
      bookmarks: new BookmarkController(bookmarkService),
      highlights: new HighlightController(highlightService),
      collections: new CollectionController(collectionService),
      reviews: new ReviewController(reviewService),
      rights: new RightsController(rightsService),
      audits: new AuditLogController(auditService),
    }),
  );
  app.use(errorHandler);
  return app;
}
