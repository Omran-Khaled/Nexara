import { ReadingHistoryEntry, ReadingProgress } from '../types';
import { ApiData, http } from './http';

export interface ApiReadingProgress extends ReadingProgress {
  id: string;
  userId: string;
  clientSequence: number;
  clientUpdatedAt: string;
}
export interface ProgressWriteInput {
  userId: string;
  editionId: string;
  currentChapterIndex: number;
  currentScrollPercent: number;
  completedPercent: number;
  totalSecondsSpent: number;
  clientSequence: number;
  clientUpdatedAt: string;
}
export const readingApi = {
  upsert(bookId: string, input: ProgressWriteInput) { return http.request<ApiData<ApiReadingProgress>>(`/reading-progress/${encodeURIComponent(bookId)}`, { method: 'PUT', body: input }); },
  list(userId: string, signal?: AbortSignal) { return http.request<ApiData<ApiReadingProgress[]>>(`/reading-progress?${new URLSearchParams({ userId })}`, { signal }); },
  recordOpened(bookId: string, editionId: string) { return http.request<ApiData<ReadingHistoryEntry>>(`/reading-history/${encodeURIComponent(bookId)}/open`, { method: 'POST', body: { editionId } }); },
  listHistory(userId: string, signal?: AbortSignal) { return http.request<ApiData<ReadingHistoryEntry[]>>(`/reading-history?${new URLSearchParams({ userId, limit: '50' })}`, { signal }); },
};
