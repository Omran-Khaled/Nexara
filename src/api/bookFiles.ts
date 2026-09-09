import { RightsVerificationMethod } from './rights';
import { ApiData, http } from './http';
import { BookFile, FileFormat, RightsStatus } from '../types';

export interface DirectUploadInput {
  format: FileFormat;
  mimeType: string;
}

/** 'signed' targets S3-compatible storage via a browser PUT; 'server' stages bytes through the API (local development). */
export type DirectUploadTarget =
  | { mode: 'signed'; temporaryStorageKey: string; href: string; expiresAt: string; requiredContentType: string }
  | { mode: 'server'; expiresAt: string; maxBytes: number };

export interface DirectUploadRights {
  bookId: string;
  editionId: string;
  status: RightsStatus;
  /** Derivable legal/audit fields are optional: the server auto-completes them from the referenced catalog edition. */
  licenseType?: string;
  source?: string;
  evidence?: string;
  verificationMethod?: RightsVerificationMethod;
  territory?: string;
  attribution?: string;
  sourceUrl?: string;
  permalink?: string;
  rightsEvidenceUrl?: string;
  notes?: string;
}

export interface CompleteDirectUploadInput {
  format: FileFormat;
  mimeType: string;
  temporaryStorageKey: string;
  originalName?: string;
  sourceUrl?: string;
  readingAllowed: boolean;
  downloadAllowed: boolean;
  offlineAllowed: boolean;
  rights?: DirectUploadRights;
}

export const bookFilesApi = {
  createDirectUpload: (bookId: string, editionId: string, input: DirectUploadInput) => http.request<ApiData<DirectUploadTarget>>(
    `/books/${encodeURIComponent(bookId)}/editions/${encodeURIComponent(editionId)}/files/direct-upload`,
    { method: 'POST', body: input, timeoutMs: 20_000, retry: false },
  ),

  async uploadToSignedTarget(target: DirectUploadTarget & { mode: 'signed' }, file: Blob): Promise<void> {
    const response = await fetch(target.href, {
      method: 'PUT',
      headers: { 'content-type': target.requiredContentType },
      body: file,
    });
    if (!response.ok) throw new Error(`Signed upload failed with status ${response.status}.`);
  },

  /** Server-mediated staging for providers without signed-write URLs (development local storage). */
  stageServerBody: (bookId: string, editionId: string, input: DirectUploadInput, file: Blob) => http.request<ApiData<{ temporaryStorageKey: string }>>(
    `/books/${encodeURIComponent(bookId)}/editions/${encodeURIComponent(editionId)}/files/direct-upload/staged-body`,
    {
      method: 'POST',
      body: file,
      headers: { 'content-type': input.mimeType, 'x-file-format': input.format },
      timeoutMs: 120_000,
      retry: false,
    },
  ),

  completeDirectUpload: (bookId: string, editionId: string, input: CompleteDirectUploadInput) => http.request<ApiData<BookFile>>(
    `/books/${encodeURIComponent(bookId)}/editions/${encodeURIComponent(editionId)}/files/complete-direct-upload`,
    { method: 'POST', body: input, timeoutMs: 30_000, retry: false },
  ),
};
