import assert from 'node:assert/strict';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mongo = await MongoMemoryServer.create();
const storageRoot = `.data/runtime-smoke-${process.pid}`;

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = mongo.getUri();
process.env.MONGODB_DB_NAME = 'nexara-runtime-smoke';
process.env.BOOK_STORAGE_PROVIDER = 'local';
process.env.BOOK_STORAGE_LOCAL_ROOT = storageRoot;
process.env.AUTH_PROVIDER = 'supabase';
process.env.NEXARA_APPLY_MIGRATIONS_ON_STARTUP = 'true';
process.env.NEXARA_STARTUP_READINESS_REQUIRED = 'false';
process.env.NEXARA_CORS_ORIGINS = 'http://127.0.0.1';

const { closeRuntimeApp, getRuntimeApp } = await import('../server/runtime/createRuntimeApp');
const app = await getRuntimeApp();
const server = app.listen(0, '127.0.0.1');

try {
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const address = server.address();
  assert(address && typeof address !== 'string', 'Runtime smoke server did not bind a TCP port.');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const [live, ready, missingRoute] = await Promise.all([
    fetch(`${baseUrl}/api/health/live`),
    fetch(`${baseUrl}/api/health/ready`),
    fetch(`${baseUrl}/api/runtime-smoke-missing-route`),
  ]);
  const readyBody = await ready.json() as { ready?: unknown };

  assert.equal(live.status, 200, 'Liveness endpoint did not return 200.');
  assert.equal(ready.status, 200, 'Readiness endpoint did not return 200.');
  assert.equal(readyBody.ready, true, 'Readiness report was not ready.');
  assert.equal(missingRoute.status, 404, 'Unknown API route did not return 404.');

  console.log(JSON.stringify({
    passed: true,
    statuses: { live: live.status, ready: ready.status, missingRoute: missingRoute.status },
  }));
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  await closeRuntimeApp();
  await mongo.stop();
}
