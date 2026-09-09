import { Book } from '../types';
import { ApiData, http, PageResult } from './http';

export interface BookListParams { query?: string; page?: number; limit?: number; contentAvailability?: Book['contentAvailability']; workflowStatus?: Book['workflowStatus']; }
function query(params: BookListParams) { const search = new URLSearchParams(); for (const [key, value] of Object.entries(params)) if (value !== undefined) search.set(key, String(value)); return search.toString() ? `?${search}` : ''; }
export const booksApi = {
  list(params: BookListParams = {}, signal?: AbortSignal) { return http.request<PageResult<Book>>(`/books${query(params)}`, { signal }); },
  get(id: string, signal?: AbortSignal) { return http.request<ApiData<Book>>(`/books/${encodeURIComponent(id)}`, { signal }); },
  create(book: Book) { return http.request<ApiData<Book>>('/books', { method: 'POST', body: book }); },
  update(id: string, patch: Partial<Book>) { return http.request<ApiData<Book>>(`/books/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }); },
  delete(id: string) { return http.request<void>(`/books/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
};
