import { http } from './http';

export interface IngestionStage { name: string; status: 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'SKIPPED'; message?: string; evidence?: Record<string, unknown>; }
export interface IngestionJob { id: string; provider: string; providerExternalId: string; status: string; stages: IngestionStage[]; candidateBookId?: string; reviewedBy?: string; reviewedAt?: string; sourceFile?: { url: string; mimeType: string; bytes: number; sha256: string; fileId?: string; storageKey?: string }; failureReason?: string; createdAt: string; updatedAt: string; }

export const ingestionApi = {
  startGutenberg: (externalId: string) => http.request<{ data: IngestionJob }>('/ingestions/gutenberg', { method: 'POST', body: { externalId } }),
  startWikisource: (externalId: string, language: string) => http.request<{ data: IngestionJob }>('/ingestions/wikisource', { method: 'POST', body: { externalId, language } }),
  startAco: (externalId: string) => http.request<{ data: IngestionJob }>('/ingestions/aco', { method: 'POST', body: { externalId } }),
  list: () => http.request<{ data: IngestionJob[] }>('/ingestions'),
  get: (id: string) => http.request<{ data: IngestionJob }>(`/ingestions/${encodeURIComponent(id)}`),
  publish: (id: string) => http.request<{ data: IngestionJob }>(`/ingestions/${encodeURIComponent(id)}/publish`, { method: 'POST' }),
};
