import assert from 'node:assert/strict';
import { ApiError, HttpClient, toUiError } from '../src/api/http';
import { booksApi } from '../src/api/books';

const originalFetch = globalThis.fetch;
try {
  let requested = '';
  globalThis.fetch = (async (input: string | URL | Request) => {
    requested = String(input);
    return new Response(JSON.stringify({ data: [], total: 0, page: 2, limit: 12 }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  const page = await booksApi.list({ query: 'heritage', page: 2, limit: 12 });
  assert.equal(page.page, 2);
  assert.match(requested, /\/api\/books\?query=heritage&page=2&limit=12/);

  globalThis.fetch = (async () => new Response(JSON.stringify({ error: { message: 'hidden' } }), { status: 404, headers: { 'content-type': 'application/json' } })) as typeof fetch;
  await assert.rejects(() => new HttpClient('/api').request('/books/missing'), (error: unknown) => error instanceof ApiError && error.ui.kind === 'not_found' && error.ui.status === 404 && !error.message.includes('hidden'));

  globalThis.fetch = (async () => { throw new TypeError('network unreachable'); }) as typeof fetch;
  await assert.rejects(() => new HttpClient('/api').request('/books'), (error: unknown) => error instanceof ApiError && error.ui.kind === 'network' && error.ui.retryable);
  assert.equal(toUiError(new Error('driver secret')).messageAr, 'الاتصال غير متاح. يرجى إعادة المحاولة.');
  console.log('P2 API client checks passed.');
} finally {
  globalThis.fetch = originalFetch;
}
