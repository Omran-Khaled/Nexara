import { BookChapter } from "../types";
import { ApiData, http } from "./http";

export const chaptersApi = {
  get(bookId: string, index: number, signal?: AbortSignal) {
    return http.request<ApiData<BookChapter> & { index: number }>(
      `/books/${encodeURIComponent(bookId)}/chapters/${index}`,
      { signal },
    );
  },
};
