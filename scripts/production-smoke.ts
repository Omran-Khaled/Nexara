type EndpointResult = { endpoint: string; status: number; latencyMs: number };

const rawBaseUrl = process.env.NEXARA_DEPLOY_URL?.trim();
if (!rawBaseUrl) throw new Error('NEXARA_DEPLOY_URL is required, for example https://library.example.com.');
const baseUrl = new URL(rawBaseUrl);
if (baseUrl.protocol !== 'https:') throw new Error('NEXARA_DEPLOY_URL must use HTTPS.');
if (baseUrl.pathname !== '/' || baseUrl.search || baseUrl.hash) throw new Error('NEXARA_DEPLOY_URL must be an origin without a path, query, or fragment.');

async function request(path: string, expectedStatus: number): Promise<{ body: unknown; result: EndpointResult }> {
  const startedAt = Date.now();
  const response = await fetch(new URL(path, baseUrl), { signal: AbortSignal.timeout(12_000), redirect: 'error' });
  const result = { endpoint: path, status: response.status, latencyMs: Date.now() - startedAt };
  if (response.status !== expectedStatus) throw new Error(`${path} returned HTTP ${response.status}; expected ${expectedStatus}.`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) throw new Error(`${path} did not return JSON.`);
  return { body: await response.json(), result };
}

const results: EndpointResult[] = [];
const live = await request('/api/health/live', 200); results.push(live.result);
const ready = await request('/api/health/ready', 200); results.push(ready.result);
if (!ready.body || typeof ready.body !== 'object' || (ready.body as { ready?: unknown }).ready !== true) {
  throw new Error('Readiness endpoint did not confirm all required dependencies are ready.');
}
const supabase = await request('/api/supabase/status', 200); results.push(supabase.result);
if (!supabase.body || typeof supabase.body !== 'object' || (supabase.body as { connected?: unknown }).connected !== true) {
  throw new Error('Supabase status endpoint did not confirm a live connection.');
}
const catalog = await request('/api/books?limit=5', 200); results.push(catalog.result);
const catalogBody = catalog.body as { data?: unknown };
if (!Array.isArray(catalogBody.data) || catalogBody.data.length === 0) {
  throw new Error('Public catalog returned no published books; no real catalog visibility was verified.');
}

console.log(JSON.stringify({ checkedAt: new Date().toISOString(), baseUrl: baseUrl.origin, passed: true, results, publishedBookCountObserved: catalogBody.data.length }, null, 2));
