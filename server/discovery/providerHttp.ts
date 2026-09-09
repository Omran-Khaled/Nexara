import { ProviderError } from '../errors/ApplicationErrors';

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); }, { once: true });
  });
}
function combinedSignal(parent: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  parent?.addEventListener('abort', abort, { once: true });
  return { signal: controller.signal, timedOut: () => controller.signal.aborted && !parent?.aborted, close: () => { clearTimeout(timer); parent?.removeEventListener('abort', abort); } };
}

/** GET-only provider transport: one bounded retry for transient faults, never for cancellation or a non-server response. */
export async function providerFetch(fetchFn: typeof fetch, provider: string, stage: string, url: string, init: RequestInit, options: { timeoutMs: number; signal?: AbortSignal; attempts?: number } ): Promise<Response> {
  const attempts = options.attempts ?? 4;
  let last: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const budget = combinedSignal(options.signal, options.timeoutMs);
    try {
      const response = await fetchFn(url, { ...init, signal: budget.signal });
      if (response.status < 500) return response;
      last = new Error(`${provider} HTTP ${response.status}`);
      if (attempt < attempts) { await wait(125 * attempt, options.signal); continue; }
      throw new ProviderError(provider, stage, `${provider} failed after its bounded retry budget.`, 502, { status: response.status, attempt });
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (options.signal?.aborted) throw new ProviderError(provider, stage, 'The provider request was cancelled with its parent request.', 499, { cancelled: true });
      last = error;
      if (attempt < attempts) { await wait(125 * attempt, options.signal); continue; }
      throw new ProviderError(provider, stage, budget.timedOut() ? `${provider} exceeded its time budget after a bounded retry.` : `${provider} could not be reached after a bounded retry.`, 502, { timedOut: budget.timedOut(), cause: error instanceof Error ? error.message : 'unknown' });
    } finally { budget.close(); }
  }
  throw new ProviderError(provider, stage, 'The provider retry budget was exhausted.', 502, { cause: last instanceof Error ? last.message : 'unknown' });
}
