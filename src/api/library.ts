import { Bookmark, Highlight, UserCollection } from '../types';
import { ApiData, http } from './http';

export type ApiBookmark = Bookmark & { userId: string };
export type ApiHighlight = Highlight & { userId: string };
export type ApiCollection = UserCollection & { userId: string };
const query = (userId: string) => `?${new URLSearchParams({ userId })}`;
export const libraryApi = {
  listBookmarks(userId: string, signal?: AbortSignal) { return http.request<ApiData<ApiBookmark[]>>(`/bookmarks${query(userId)}`, { signal }); },
  createBookmark(input: Omit<ApiBookmark, 'id' | 'createdAt'>) { return http.request<ApiData<ApiBookmark>>('/bookmarks', { method: 'POST', body: input }); },
  deleteBookmark(id: string, userId: string) { return http.request<void>(`/bookmarks/${encodeURIComponent(id)}${query(userId)}`, { method: 'DELETE' }); },
  listHighlights(userId: string, signal?: AbortSignal) { return http.request<ApiData<ApiHighlight[]>>(`/highlights${query(userId)}`, { signal }); },
  createHighlight(input: { userId: string; bookId: string; chapterIndex: number; selectedText: string; color: Highlight['color']; note?: string }) { return http.request<ApiData<ApiHighlight>>('/highlights', { method: 'POST', body: input }); },
  updateHighlightNote(id: string, userId: string, note: string) { return http.request<ApiData<ApiHighlight>>(`/highlights/${encodeURIComponent(id)}/note${query(userId)}`, { method: 'PATCH', body: { note } }); },
  deleteHighlight(id: string, userId: string) { return http.request<void>(`/highlights/${encodeURIComponent(id)}${query(userId)}`, { method: 'DELETE' }); },
  listCollections(userId: string, signal?: AbortSignal) { return http.request<ApiData<ApiCollection[]>>(`/collections${query(userId)}`, { signal }); },
  createCollection(input: Omit<ApiCollection, 'id' | 'createdAt'>) { return http.request<ApiData<ApiCollection>>('/collections', { method: 'POST', body: input }); },
  updateCollectionBookIds(id: string, userId: string, bookIds: string[]) { return http.request<ApiData<ApiCollection>>(`/collections/${encodeURIComponent(id)}/books${query(userId)}`, { method: 'PUT', body: { bookIds } }); },
  deleteCollection(id: string, userId: string) { return http.request<void>(`/collections/${encodeURIComponent(id)}${query(userId)}`, { method: 'DELETE' }); },
};
