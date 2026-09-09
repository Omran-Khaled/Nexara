import { getRuntimeApp, closeRuntimeApp } from '../server/runtime/createRuntimeApp';

const app = await getRuntimeApp();
const server = app.listen(0);
try {
  await new Promise<void>((resolve, reject) => server.once('listening', resolve).once('error', reject));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Runtime API did not bind a TCP port.');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const [live, ready, supabase] = await Promise.all([
    fetch(`${baseUrl}/api/health/live`),
    fetch(`${baseUrl}/api/health/ready`),
    fetch(`${baseUrl}/api/supabase/status`),
  ]);
  const readyBody = await ready.json() as { ready?: unknown; dependencies?: unknown };
  const supabaseBody = await supabase.json() as { connected?: unknown };
  if (!live.ok || !ready.ok || readyBody.ready !== true || !supabase.ok || supabaseBody.connected !== true) {
    throw new Error('Runtime API did not pass live dependency checks.');
  }
  console.log(JSON.stringify({ passed: true, statuses: { live: live.status, ready: ready.status, supabase: supabase.status }, dependencies: readyBody.dependencies }, null, 2));
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closeRuntimeApp();
}
