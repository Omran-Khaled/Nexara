import { UserRole } from '../types';
import { ApiData, http } from './http';

export interface ServerAccount {
  id: string;
  email: string | null;
  roles: Array<'READER' | 'MODERATOR' | 'ADMIN'>;
  permissions: string[];
  territory: string | null;
}

export function primaryUserRole(roles: ServerAccount['roles']): UserRole {
  if (roles.includes('ADMIN')) return 'ADMIN';
  if (roles.includes('MODERATOR')) return 'MODERATOR';
  return 'READER';
}

export const accountApi = {
  me: () => http.request<ApiData<ServerAccount>>('/auth/me', { method: 'GET', timeoutMs: 10_000, retry: false }),
};
