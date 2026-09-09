import { RightsStatus } from '../types';
import { ApiData, http } from './http';

export type RightsVerificationMethod = 'MANUAL_REVIEW' | 'LICENSE_DOCUMENT' | 'PROVIDER_ASSERTION' | 'RIGHTS_DATABASE';

export interface CreateRightsRecordInput {
  bookId: string;
  editionId: string;
  status: RightsStatus;
  licenseType: string;
  source: string;
  evidence: string;
  verificationMethod: RightsVerificationMethod;
  territory: string;
  attribution: string;
  sourceProvider?: string;
  providerExternalId?: string;
  sourceUrl?: string;
  permalink?: string;
  rightsEvidenceUrl?: string;
  sourceFileSha256?: string;
  verifiedAt?: string;
  notes?: string;
}

export interface RightsRecord extends CreateRightsRecordInput {
  id: string;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
}

export const rightsApi = {
  create: (input: CreateRightsRecordInput) => http.request<ApiData<RightsRecord>>('/rights-records', { method: 'POST', body: input, timeoutMs: 20_000, retry: false }),
  listByBook: (bookId: string) => http.request<ApiData<RightsRecord[]>>(`/books/${encodeURIComponent(bookId)}/rights-records`, { method: 'GET', timeoutMs: 10_000, retry: false }),
};
