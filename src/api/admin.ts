import { Book } from "../types";
import { booksApi } from "./books";
import { ApiData, http } from "./http";

export type ManagedRole = "READER" | "MODERATOR" | "ADMIN";
export interface RoleAssignment {
  id: string;
  userId: string;
  role: ManagedRole;
  assignedBy: string;
  assignedAt: string;
}

export const adminApi = {
  createBook: (book: Book) => booksApi.create(book),
  updateBook: (id: string, patch: Partial<Book>) => booksApi.update(id, patch),
  deleteBook: (id: string) => booksApi.delete(id),
  assignRole: (userId: string, role: ManagedRole) =>
    http.request<ApiData<RoleAssignment>>(
      `/admin/users/${encodeURIComponent(userId)}/roles`,
      { method: "POST", body: { role }, timeoutMs: 10_000, retry: false },
    ),
  revokeRole: (userId: string, role: ManagedRole) =>
    http.request<void>(`/admin/users/${encodeURIComponent(userId)}/roles`, {
      method: "DELETE",
      body: { role },
      timeoutMs: 10_000,
      retry: false,
    }),
};
