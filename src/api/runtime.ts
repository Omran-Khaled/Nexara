import { Achievement, Author, NotificationItem, ReadingPath, TimeCapsule } from '../types';
import { ApiData, http } from './http';

export interface UserBookState {
  id: string;
  bookId: string;
  saved: boolean;
  favourite: boolean;
  shelf: 'SAVED' | 'CURRENTLY_READING' | 'WANT_TO_READ' | 'FINISHED' | 'NONE';
  updatedAt: string;
}

export interface DownloadHistoryItem {
  id: string;
  bookId: string;
  editionId: string;
  format: 'PDF' | 'EPUB' | 'TXT' | 'HTML';
  downloadedAt: string;
}

export interface RuntimePersonalData {
  bookStates: UserBookState[];
  downloads: DownloadHistoryItem[];
  achievements: Achievement[];
  notifications: NotificationItem[];
  timeCapsules: TimeCapsule[];
}

export const runtimeApi = {
  listAuthors: () => http.request<ApiData<Author[]>>('/authors'),
  listReadingPaths: () => http.request<ApiData<ReadingPath[]>>('/reading-paths'),
  getPersonal: () => http.request<ApiData<RuntimePersonalData>>('/me/runtime-data'),
  saveBookState: (input: Omit<UserBookState, 'id' | 'updatedAt'>) => http.request<ApiData<UserBookState>>('/me/book-states', { method: 'PUT', body: input }),
  createTimeCapsule: (input: Pick<TimeCapsule, 'bookId' | 'unlockDate' | 'personalNote'>) => http.request<ApiData<TimeCapsule>>('/me/time-capsules', { method: 'POST', body: input }),
  markNotificationRead: (id: string) => http.request<ApiData<NotificationItem>>(`/me/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH', body: {} }),
};
