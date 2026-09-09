import { http } from './http';

function filenameFromDisposition(value: string | null, fallback: string): string {
  const match = /filename="?([^";]+)"?/i.exec(value || '');
  return match?.[1]?.replace(/[\\/]/g, '-') || fallback;
}

/** Delivers only the server-verified public-domain bytes through the shared P7 transport policy. */
export async function downloadGutenbergBook(id: string, format: 'txt' | 'html' = 'txt', signal?: AbortSignal): Promise<void> {
  const response = await http.requestRaw(`/discovery/gutenberg/${encodeURIComponent(id)}/download?format=${format}`, {
    signal,
    timeoutMs: 18_000,
    retry: { maxAttempts: 2, baseDelayMs: 160 },
    credentials: 'same-origin',
  });
  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filenameFromDisposition(response.headers.get('content-disposition'), `gutenberg-${id}.${format}`);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}
