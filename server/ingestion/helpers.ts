import { createHash } from 'node:crypto';
import { FileFormat, LanguageCode } from '../../src/types';
import { ValidationError } from '../errors/ApplicationErrors';
import { IngestionMimeType, IngestionStageName } from '../models/ingestion';

/**
 * Pure ingestion primitives shared by every stage of the reviewed book-import
 * pipeline: hashing, slugging, approved-source HTTP fetching, HTML-to-text
 * extraction, format detection, and deterministic chapter segmentation.
 */

export const STAGES: IngestionStageName[] = ['DISCOVERY', 'METADATA_NORMALIZATION', 'RIGHTS_VERIFICATION', 'CONTENT_ACQUISITION', 'FILE_VALIDATION', 'TEXT_EXTRACTION', 'CHAPTER_EXTRACTION', 'COVER_NORMALIZATION', 'METADATA_ENRICHMENT', 'PERSISTENCE', 'PUBLISHING'];
export const MAX_SOURCE_BYTES = 50 * 1024 * 1024;

export const iso = () => new Date().toISOString();

export const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

export const slug = (value: string) => value.toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 96) || 'untitled';

export function allowedHost(host: string): boolean {
  return host === 'www.gutenberg.org' || host.endsWith('.gutenberg.org') || host.endsWith('.wikisource.org') || host === 'aco.dlib.nyu.edu' || host === 'dlib.nyu.edu';
}

export function approvedUrl(value: string, field = 'sourceUrl'): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new ValidationError({ [field]: 'must be a valid HTTPS URL.' }); }
  if (url.protocol !== 'https:' || url.username || url.password || !allowedHost(url.hostname.toLowerCase())) throw new ValidationError({ [field]: 'must use an approved public HTTPS source host.' });
  return url;
}

export async function fetchApproved(value: string, accept: string): Promise<Response> {
  let url = approvedUrl(value);
  for (let hop = 0; hop < 4; hop += 1) {
    const response = await fetch(url, { headers: { 'user-agent': 'Nexara Digital Library reviewed ingestion', accept }, redirect: 'manual', signal: AbortSignal.timeout(25_000) });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    if (!location) throw new ValidationError({ sourceUrl: 'source returned an incomplete redirect.' });
    url = approvedUrl(new URL(location, url).toString());
  }
  throw new ValidationError({ sourceUrl: 'source exceeded the redirect limit.' });
}

export async function readIngestionBody(response: Response, field: string): Promise<Buffer> {
  if (!response.ok) throw new ValidationError({ [field]: `source returned HTTP ${response.status}.` });
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > MAX_SOURCE_BYTES) throw new ValidationError({ [field]: 'source exceeds the 50 MB import limit.' });
  const value = Buffer.from(await response.arrayBuffer());
  if (!value.length || value.length > MAX_SOURCE_BYTES) throw new ValidationError({ [field]: 'source is empty or exceeds the 50 MB import limit.' });
  return value;
}

export function plainHtml(value: string): string {
  return value.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

export function pageTitle(value: string): string {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(value);
  return match ? plainHtml(match[1]).replace(/^Arabic Collections Online\s*:\s*/i, '').trim() : '';
}

export function normalizedCover(value?: string): string {
  try { return value ? approvedUrl(value, 'coverUrl').toString() : '/covers/ingestion-placeholder.svg'; } catch { return '/covers/ingestion-placeholder.svg'; }
}

export function formatFor(mime: IngestionMimeType): FileFormat {
  return mime === 'application/pdf' ? 'PDF' : mime.startsWith('text/html') ? 'HTML' : 'TXT';
}

export function fileRef(id: string, format: FileFormat, mimeType: string, sizeBytes: number, checksum: string, sourceUrl: string, storageKey: string, storageProvider: string) {
  const timestamp = iso();
  return { id, format, mimeType, storageKey, sizeBytes, checksum, sourceUrl, storageProvider, sizeFormatted: `${Math.max(1, Math.round(sizeBytes / 1024))} KB`, downloadAllowed: true, readingAllowed: true, offlineAllowed: true, createdAt: timestamp, updatedAt: timestamp, verifiedAt: timestamp };
}

export function sourceText(content: Buffer, mime: IngestionMimeType): string {
  const text = mime.startsWith('text/html') ? plainHtml(content.toString('utf8')) : content.toString('utf8');
  return text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

export function language(value: string): LanguageCode {
  return ['ar', 'en', 'fr', 'de', 'es', 'it', 'ru', 'fa', 'tr', 'zh', 'ja', 'ko', 'el', 'la', 'pt', 'nl', 'he', 'ur'].includes(value) ? value as LanguageCode : 'en';
}