import { AuditLog } from '../types';
import { ApiData, http } from './http';

export const auditApi = {
  list(params: { entityType?: string; entityId?: string } = {}, signal?: AbortSignal) {
    const search = new URLSearchParams();
    if (params.entityType) search.set('entityType', params.entityType);
    if (params.entityId) search.set('entityId', params.entityId);
    return http.request<ApiData<AuditLog[]>>(`/audit-logs${search.size ? `?${search}` : ''}`, { signal });
  },
};
