import { ApiData, http } from './http';
import { FileFormat, RightsStatus } from '../types';

export type DownloadAvailabilityStatus = 'AVAILABLE' | 'RIGHTS_RESTRICTED' | 'MISSING_FILE' | 'SOURCE_UNAVAILABLE';
export interface AvailableDownloadFile { id: string; format: FileFormat; mimeType: string; sizeBytes: number; sizeFormatted: string; sourceUrl?: string; storageProvider: string; availability: DownloadAvailabilityStatus; }
export interface DownloadAvailability { bookId: string; editionId: string; rightsStatus: RightsStatus; licenseType: string; source: string; attribution: string; territory: string | null; permittedByRights: boolean; sourceProviderAvailable: boolean; files: AvailableDownloadFile[]; }
export interface AuthorizedDownload { href: string; expiresAt: string; external: boolean; file: AvailableDownloadFile; }

function filenameFromDisposition(value: string | null, fallback: string): string { const match = /filename="?([^";]+)"?/i.exec(value || ''); return match?.[1] || fallback; }
function safeFilename(title: string, format: FileFormat): string { const stem = title.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').slice(0, 120) || 'nexara-book'; return `${stem}.${format.toLowerCase()}`; }

export const downloadsApi = {
  availability(bookId: string, editionId: string, signal?: AbortSignal) {
    return http.request<ApiData<DownloadAvailability>>(`/books/${encodeURIComponent(bookId)}/editions/${encodeURIComponent(editionId)}/downloads`, { signal, timeoutMs: 8_000, retry: { maxAttempts: 2, baseDelayMs: 120 } });
  },
  authorize(bookId: string, editionId: string, fileId: string, expiresInSeconds = 300, signal?: AbortSignal) {
    return http.request<ApiData<AuthorizedDownload>>(`/books/${encodeURIComponent(bookId)}/editions/${encodeURIComponent(editionId)}/files/${encodeURIComponent(fileId)}/downloads`, { method: 'POST', body: { expiresInSeconds }, signal, timeoutMs: 10_000, retry: false });
  },
  async downloadOriginal(bookId: string, editionId: string, file: AvailableDownloadFile, title: string, signal?: AbortSignal): Promise<void> {
    const { data } = await this.authorize(bookId, editionId, file.id, 300, signal);
    const response = await http.requestRaw(data.href, {
      absoluteUrl: data.external,
      signal,
      timeoutMs: data.external ? 30_000 : 20_000,
      retry: { maxAttempts: 2, baseDelayMs: 180 },
      credentials: data.external ? 'omit' : 'same-origin',
    });
    const blob = await response.blob();
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = filenameFromDisposition(response.headers.get('content-disposition'), safeFilename(title, data.file.format));
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(href);
  },
};
