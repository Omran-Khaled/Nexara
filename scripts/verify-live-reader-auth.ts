import { getRuntimeApp, closeRuntimeApp } from '../server/runtime/createRuntimeApp';

const supabaseUrl = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const email = process.env.NEXARA_READER_EMAIL || 'reader1@nxara.com';
const password = process.env.NEXARA_READER_PASSWORD;
if (!supabaseUrl || !publishableKey || !password) throw new Error('SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and NEXARA_READER_PASSWORD are required.');

const tokenResponse = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: publishableKey, 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
  signal: AbortSignal.timeout(15_000),
});
const tokenBody = await tokenResponse.json() as { access_token?: unknown; error_description?: unknown; message?: unknown };
if (!tokenResponse.ok || typeof tokenBody.access_token !== 'string') throw new Error(`Reader sign-in failed: ${String(tokenBody.error_description || tokenBody.message || `HTTP ${tokenResponse.status}`)}`);

const app = await getRuntimeApp();
const server = app.listen(0);
try {
  await new Promise<void>((resolve, reject) => server.once('listening', resolve).once('error', reject));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Runtime API did not bind a TCP port.');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const headers = { authorization: `Bearer ${tokenBody.access_token}`, 'content-type': 'application/json' };
  const me = await fetch(`${baseUrl}/api/auth/me`, { headers });
  const meBody = await me.json() as { data?: { email?: unknown; roles?: unknown } };
  const forbiddenDirectUpload = await fetch(`${baseUrl}/api/books/live-test-book/editions/live-test-edition/files/direct-upload`, { method: 'POST', headers, body: JSON.stringify({ format: 'TXT', mimeType: 'text/plain' }) });
  if (!me.ok || meBody.data?.email !== email || !Array.isArray(meBody.data?.roles) || !meBody.data.roles.includes('READER') || forbiddenDirectUpload.status !== 403) {
    throw new Error('Reader authorization verification failed.');
  }
  console.log(JSON.stringify({ passed: true, authenticatedEmail: meBody.data.email, roles: meBody.data.roles, forbiddenAdminUploadStatus: forbiddenDirectUpload.status }, null, 2));
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closeRuntimeApp();
}
