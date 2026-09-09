import express from "express";
import path from "path";
import dns from "node:dns";
import { createServer as createViteServer } from "vite";
import { loadServerConfig } from "./server/config/env";
import {
  closeRuntimeApp,
  getRuntimeApp,
} from "./server/runtime/createRuntimeApp";
import { logEvent } from "./server/observability/logger";
import { ApplicationError } from "./server/errors/ApplicationErrors";

// --- MongoDB connectivity hardening (environment-gated) ------------------
// Local dev on this machine has an IPv6-only VPN DNS server that Node's
// built-in resolver (c-ares) cannot use, which breaks SRV/A lookups and
// surfaces as "querySrv ETIMEOUT" when connecting to MongoDB Atlas. Forcing
// public IPv4 servers + ipv4first resolves that on the dev box only.
// This is an environment-specific workaround and is therefore:
//   - NEVER applied when NODE_ENV=production (production has its own
//     network/DNS policy and must resolve MongoDB normally).
//   - Disabled explicitly with NEXARA_ENABLE_DNS_FIX=false.
const enableDnsFix =
  process.env.NEXARA_ENABLE_DNS_FIX !== 'false' &&
  process.env.NODE_ENV !== 'production';
if (enableDnsFix) {
  dns.setServers(["1.1.1.1", "8.8.8.8"]);
  dns.setDefaultResultOrder("ipv4first");
}

function redactStartupMessage(value: string): string {
  return value
    .replace(/mongodb(?:\+srv)?:\/\/[^@\s]+@/gi, "mongodb://[redacted]@")
    .replace(/\b(password|secret|token)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
    .slice(0, 600);
}

function startupFailureDetails(error: unknown) {
  const application = error instanceof ApplicationError ? error : null;
  const cause =
    application?.details instanceof Error ? application.details : null;
  const code =
    cause && typeof (cause as { code?: unknown }).code === "string"
      ? (cause as unknown as { code: string }).code
      : undefined;

  return {
    errorCode: application?.code,
    errorMessage:
      error instanceof Error
        ? redactStartupMessage(error.message)
        : String(error),
    causeType: cause?.name,
    causeCode: code,
    causeMessage: cause ? redactStartupMessage(cause.message) : undefined,
  };
}

async function startServer() {
  const config = loadServerConfig();
  const app = await getRuntimeApp();

  if (config.nodeEnv !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { maxAge: "1d", etag: true }));
    app.get("*", (_req, res) =>
      res.sendFile(path.join(distPath, "index.html")),
    );
  }

  const server = app.listen(config.port, "0.0.0.0", () => {
    logEvent("info", "server_started", {
      provider: "mongodb",
      outcome: "started",
      port: config.port,
      nodeEnv: config.nodeEnv,
    });
  });
  const shutdown = async () => {
    logEvent("info", "server_shutdown", { outcome: "stopping" });
    server.close();
    await closeRuntimeApp();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

startServer().catch((error) => {
  logEvent('error', 'server_start_failed', {
    errorType: error instanceof Error ? error.name : typeof error,
    outcome: 'failed',
    ...startupFailureDetails(error),
  });
  process.exitCode = 1;
});