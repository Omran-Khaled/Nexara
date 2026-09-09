import { HighlightColor, RightsStatus } from '../../src/types';
import { ValidationError } from '../errors/ApplicationErrors';
import { parseId } from '../utils/http';
import { isStrictIsoUtc } from '../utils/semantics';

const colors: HighlightColor[] = ['gold', 'moss', 'burgundy', 'blue'];
const rightsStatuses: RightsStatus[] = ['PUBLIC_DOMAIN', 'LICENSED', 'OPEN_ACCESS', 'PREVIEW_ONLY', 'RESTRICTED', 'UNAVAILABLE'];

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError('body must be an object.');
  return value as Record<string, unknown>;
}
function text(value: unknown, field: string, max = 20_000): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new ValidationError({ [field]: `must be a non-empty string with at most ${max} characters.` });
  return value.trim();
}
function optionalText(value: unknown, field: string, max = 20_000): string | undefined {
  if (value === undefined) return undefined;
  return text(value, field, max);
}
function nonNegativeInt(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) throw new ValidationError({ [field]: 'must be a non-negative integer.' });
  return value as number;
}
function percent(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) throw new ValidationError({ [field]: 'must be a number between 0 and 100.' });
  return value;
}
function advisoryUserId(value: unknown): string { return value === undefined ? 'untrusted-client-id' : parseId(value, 'userId'); }
function advisoryText(value: unknown, fallback: string, field: string, max: number): string { return value === undefined ? fallback : text(value, field, max); }

export interface ProgressInput { userId: string; editionId: string; currentChapterIndex: number; currentScrollPercent: number; completedPercent: number; totalSecondsSpent: number; clientSequence: number; clientUpdatedAt: string; }
export function validateProgress(body: unknown): ProgressInput {
  const input = object(body);
  const completedPercent = percent(input.completedPercent, 'completedPercent');
  const currentScrollPercent = percent(input.currentScrollPercent, 'currentScrollPercent');
  if (completedPercent < currentScrollPercent) throw new ValidationError({ completedPercent: 'cannot be lower than currentScrollPercent.' });
  const clientUpdatedAt = text(input.clientUpdatedAt, 'clientUpdatedAt', 64);
  if (!isStrictIsoUtc(clientUpdatedAt)) throw new ValidationError({ clientUpdatedAt: 'must be a strict ISO-8601 UTC timestamp.' });
  return { userId: advisoryUserId(input.userId), editionId: parseId(input.editionId, 'editionId'), currentChapterIndex: nonNegativeInt(input.currentChapterIndex, 'currentChapterIndex'), currentScrollPercent, completedPercent, totalSecondsSpent: nonNegativeInt(input.totalSecondsSpent, 'totalSecondsSpent'), clientSequence: nonNegativeInt(input.clientSequence, 'clientSequence'), clientUpdatedAt };
}

export interface BookmarkInput { userId: string; bookId: string; editionId: string; chapterIndex: number; progressPercent: number; title: string; }
export function validateBookmark(body: unknown): BookmarkInput {
  const input = object(body);
  return { userId: advisoryUserId(input.userId), bookId: parseId(input.bookId, 'bookId'), editionId: parseId(input.editionId, 'editionId'), chapterIndex: nonNegativeInt(input.chapterIndex, 'chapterIndex'), progressPercent: percent(input.progressPercent, 'progressPercent'), title: text(input.title, 'title', 500) };
}

export interface HighlightInput { userId: string; bookId: string; chapterIndex: number; selectedText: string; color: HighlightColor; note?: string; }
export function validateHighlight(body: unknown): HighlightInput {
  const input = object(body);
  if (!colors.includes(input.color as HighlightColor)) throw new ValidationError({ color: 'has an unsupported value.' });
  return { userId: advisoryUserId(input.userId), bookId: parseId(input.bookId, 'bookId'), chapterIndex: nonNegativeInt(input.chapterIndex, 'chapterIndex'), selectedText: text(input.selectedText, 'selectedText', 10_000), color: input.color as HighlightColor, note: optionalText(input.note, 'note', 10_000) };
}

export interface CollectionInput { userId: string; title: string; description?: string; isPublic: boolean; bookIds: string[]; colorTheme: string; }
export function validateCollection(body: unknown): CollectionInput {
  const input = object(body);
  if (typeof input.isPublic !== 'boolean') throw new ValidationError({ isPublic: 'must be boolean.' });
  if (!Array.isArray(input.bookIds)) throw new ValidationError({ bookIds: 'must be an array.' });
  const bookIds = input.bookIds.map((id) => parseId(id, 'bookIds'));
  if (new Set(bookIds).size !== bookIds.length) throw new ValidationError({ bookIds: 'cannot contain duplicates.' });
  return { userId: advisoryUserId(input.userId), title: text(input.title, 'title', 160), description: optionalText(input.description, 'description', 2_000), isPublic: input.isPublic, bookIds, colorTheme: text(input.colorTheme, 'colorTheme', 32) };
}

export function validateCollectionBookIds(body: unknown): string[] {
  const input = object(body);
  if (!Array.isArray(input.bookIds)) throw new ValidationError({ bookIds: 'must be an array.' });
  const bookIds = input.bookIds.map((id) => parseId(id, 'bookIds'));
  if (new Set(bookIds).size !== bookIds.length) throw new ValidationError({ bookIds: 'cannot contain duplicates.' });
  return bookIds;
}

export function validateReviewLike(body: unknown): boolean {
  const input = object(body);
  if (typeof input.liked !== 'boolean') throw new ValidationError({ liked: 'must be boolean.' });
  return input.liked;
}

export interface ReviewCommentInput { content: string; }
export function validateReviewComment(body: unknown): ReviewCommentInput { return { content: text(object(body).content, 'content', 4_000) }; }

export interface ReviewInput { userId: string; userName: string; userAvatar: string; bookId: string; rating: number; title: string; content: string; }
export function validateReview(body: unknown): ReviewInput {
  const input = object(body);
  if (!Number.isInteger(input.rating) || (input.rating as number) < 1 || (input.rating as number) > 5) throw new ValidationError({ rating: 'must be an integer between 1 and 5.' });
  return { userId: advisoryUserId(input.userId), userName: advisoryText(input.userName, 'Untrusted Client', 'userName', 160), userAvatar: advisoryText(input.userAvatar, '', 'userAvatar', 2_000), bookId: parseId(input.bookId, 'bookId'), rating: input.rating as number, title: text(input.title, 'title', 300), content: text(input.content, 'content', 10_000) };
}

export type RightsVerificationMethod = 'MANUAL_REVIEW' | 'LICENSE_DOCUMENT' | 'PROVIDER_ASSERTION' | 'RIGHTS_DATABASE';
const verificationMethods: RightsVerificationMethod[] = ['MANUAL_REVIEW', 'LICENSE_DOCUMENT', 'PROVIDER_ASSERTION', 'RIGHTS_DATABASE'];
export interface RightsInput { bookId: string; editionId?: string; status: RightsStatus; licenseType: string; source: string; evidence: string; verificationMethod: RightsVerificationMethod; territory: string; attribution: string; sourceProvider?: string; providerExternalId?: string; sourceUrl?: string; permalink?: string; rightsEvidenceUrl?: string; sourceFileSha256?: string; verifiedAt?: string; notes?: string; }
export function validateRights(body: unknown): RightsInput {
  const input = object(body);
  if (!rightsStatuses.includes(input.status as RightsStatus)) throw new ValidationError({ status: 'has an unsupported value.' });
  const evidence = text(input.evidence, 'evidence', 4_000);
  const verificationMethod = text(input.verificationMethod, 'verificationMethod', 64) as RightsVerificationMethod;
  if (!verificationMethods.includes(verificationMethod)) throw new ValidationError({ verificationMethod: 'has an unsupported value.' });
  const territory = text(input.territory, 'territory', 160);
  let verifiedAt: string | undefined;
  if (input.verifiedAt !== undefined) {
    verifiedAt = text(input.verifiedAt, 'verifiedAt', 64);
    if (!isStrictIsoUtc(verifiedAt)) throw new ValidationError({ verifiedAt: 'must be a strict ISO-8601 UTC timestamp.' });
  }
  if (['PUBLIC_DOMAIN', 'LICENSED', 'OPEN_ACCESS'].includes(input.status as string) && !verifiedAt) throw new ValidationError({ verifiedAt: 'is required for a verified rights status.' });
  return { bookId: parseId(input.bookId, 'bookId'), editionId: input.editionId === undefined ? undefined : parseId(input.editionId, 'editionId'), status: input.status as RightsStatus, licenseType: text(input.licenseType, 'licenseType', 300), source: text(input.source, 'source', 1_000), evidence, verificationMethod, territory, attribution: text(input.attribution, 'attribution', 2_000), sourceProvider: optionalText(input.sourceProvider, 'sourceProvider', 120), providerExternalId: optionalText(input.providerExternalId, 'providerExternalId', 300), sourceUrl: optionalText(input.sourceUrl, 'sourceUrl', 2_048), permalink: optionalText(input.permalink, 'permalink', 2_048), rightsEvidenceUrl: optionalText(input.rightsEvidenceUrl, 'rightsEvidenceUrl', 2_048), sourceFileSha256: optionalText(input.sourceFileSha256, 'sourceFileSha256', 128), verifiedAt, notes: optionalText(input.notes, 'notes', 10_000) };
}
