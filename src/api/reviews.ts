import { Review, ReviewComment } from "../types";
import { ApiData, http } from "./http";

export const reviewsApi = {
  listByBook(bookId: string, signal?: AbortSignal) {
    return http.request<ApiData<Review[]>>(
      `/books/${encodeURIComponent(bookId)}/reviews`,
      { signal },
    );
  },
  listFeed(limit = 50, signal?: AbortSignal) {
    return http.request<ApiData<Review[]>>(
      `/community/reviews?${new URLSearchParams({ limit: String(limit) })}`,
      { signal },
    );
  },
  create(
    input: Pick<
      Review,
      | "userId"
      | "userName"
      | "userAvatar"
      | "bookId"
      | "rating"
      | "title"
      | "content"
    >,
  ) {
    return http.request<ApiData<Review>>("/reviews", {
      method: "POST",
      body: input,
    });
  },
  setLike(reviewId: string, liked: boolean) {
    return http.request<ApiData<{ likes: number; liked: boolean }>>(
      `/reviews/${encodeURIComponent(reviewId)}/like`,
      { method: "PUT", body: { liked } },
    );
  },
  listComments(reviewId: string, signal?: AbortSignal) {
    return http.request<ApiData<ReviewComment[]>>(
      `/reviews/${encodeURIComponent(reviewId)}/comments`,
      { signal },
    );
  },
  createComment(reviewId: string, content: string) {
    return http.request<ApiData<ReviewComment>>(
      `/reviews/${encodeURIComponent(reviewId)}/comments`,
      { method: "POST", body: { content } },
    );
  },
};
