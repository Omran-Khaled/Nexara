import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { Db } from 'mongodb';
import { Author, Book, BookChapter, BookEdition, FileFormat } from '../../src/types';
import { ApplicationError, ProviderError, ValidationError } from '../errors/ApplicationErrors';
import { applyP15CatalogMigration } from '../db/migrations';
import { providerFetch } from '../discovery/providerHttp';
import { IngestionJob, IngestionStageName, IngestionStageRecord, RightsEvidence } from '../models/ingestion';
import { RightsRecord } from '../models/library';
import { MongoCatalogRepository } from '../repositories/CatalogRepository';
import { MongoIngestionRepository } from '../repositories/IngestionRepositories';
import { MongoBookFileRepository } from '../storage/MongoBookFileRepository';
import { BookFileService } from '../services/BookFileService';
import { StorageProvider, checksumOf } from '../storage/StorageProvider';
import { UploadSecurityInspector } from '../security/FileUploadSecurity';

const SOURCE_NAME = 'Standard Ebooks';
const SOURCE_HOSTS = new Set(['standardebooks.org', 'www.standardebooks.org']);
const MAX_EPUB_BYTES = 25 * 1024 * 1024;
const MAX_COVER_BYTES = 10 * 1024 * 1024;
const MIN_CHAPTERS = 2;
const MIN_CHAPTER_CHARACTERS = 160;
const INGESTOR_ID = 'catalog:ingest:p15';
const USER_AGENT = 'NexaraCatalogIngest/1.0 (+https://nexara.example/catalog-policy; manual initial catalog)';

export class CatalogQualityError extends ApplicationError {
  constructor(rule: string, message: string, details?: Record<string, unknown>) {
    super('CATALOG_QUALITY_REJECTED', 422, message, { rule, ...details });
    this.name = 'CatalogQualityError';
  }
}

export interface StandardEbookManifest {
  provider: 'StandardEbooks';
  externalId: string;
  slug: string;
  title: string;
  titleAr: string;
  author: {
    slug: string;
    name: string;
    nameAr: string;
    birthYear: number;
    deathYear: number;
    country: string;
    countryAr: string;
    bio: string;
    bioAr: string;
  };
  description: string;
  descriptionAr: string;
  genres: string[];
  genresAr: string[];
  themes: string[];
  themesAr: string[];
  publicationYear: number;
  sourcePageUrl: string;
  epubUrl: string;
  coverUrl: string;
  sourceRepositoryUrl: string;
  attribution: string;
}

/**
 * Small, curated launch list. Every item has a public Standard Ebooks landing page,
 * an EPUB distribution URL, a cover URL, and an auditable source-code repository.
 */
export const STANDARD_EBOOKS_LAUNCH_MANIFEST: readonly StandardEbookManifest[] = [
  {
    provider: 'StandardEbooks', externalId: 'jane-austen_pride-and-prejudice', slug: 'jane-austen-pride-and-prejudice-standard-ebooks', title: 'Pride and Prejudice', titleAr: 'كبرياء وهوى',
    author: { slug: 'jane-austen', name: 'Jane Austen', nameAr: 'جين أوستن', birthYear: 1775, deathYear: 1817, country: 'United Kingdom', countryAr: 'المملكة المتحدة', bio: 'English novelist known for social commentary and enduring novels of manners.', bioAr: 'روائية إنجليزية عُرفت بتعليقها الاجتماعي ورواياتها الباقية في أدب العادات.' },
    description: 'A Regency-era novel of manners in which five sisters navigate family expectations, class, and love.', descriptionAr: 'رواية من عصر الوصاية تتتبع خمس شقيقات بين توقعات العائلة والطبقة والحب.',
    genres: ['Classic', 'Romance', 'Social satire'], genresAr: ['كلاسيكيات', 'رومانسية', 'هجاء اجتماعي'], themes: ['Class', 'Marriage', 'First impressions'], themesAr: ['الطبقة', 'الزواج', 'الانطباعات الأولى'], publicationYear: 1813,
    sourcePageUrl: 'https://standardebooks.org/ebooks/jane-austen/pride-and-prejudice', epubUrl: 'https://standardebooks.org/ebooks/jane-austen/pride-and-prejudice/downloads/jane-austen_pride-and-prejudice.epub?source=download', coverUrl: 'https://standardebooks.org/images/covers/jane-austen_pride-and-prejudice/495dd49502f1fd5609a27a16f5af2f0a387accb4/cover.jpg', sourceRepositoryUrl: 'https://github.com/standardebooks/jane-austen_pride-and-prejudice',
    attribution: 'Standard Ebooks edition of Pride and Prejudice by Jane Austen. The Standard Ebooks edition is dedicated to the public domain via CC0; availability is verified for the United States.',
  },
  {
    provider: 'StandardEbooks', externalId: 'mary-shelley_frankenstein', slug: 'mary-shelley-frankenstein-standard-ebooks', title: 'Frankenstein', titleAr: 'فرانكنشتاين',
    author: { slug: 'mary-shelley', name: 'Mary Shelley', nameAr: 'ماري شيلي', birthYear: 1797, deathYear: 1851, country: 'United Kingdom', countryAr: 'المملكة المتحدة', bio: 'English novelist and author of a foundational work of science fiction.', bioAr: 'روائية إنجليزية ومؤلفة عمل تأسيسي في أدب الخيال العلمي.' },
    description: 'Victor Frankenstein creates life and confronts the moral consequences of abandoning his creation.', descriptionAr: 'يخلق فيكتور فرانكنشتاين حياة ويواجه العواقب الأخلاقية لتخليه عن مخلوقه.',
    genres: ['Classic', 'Gothic', 'Science fiction'], genresAr: ['كلاسيكيات', 'قوطي', 'خيال علمي'], themes: ['Creation', 'Responsibility', 'Isolation'], themesAr: ['الخلق', 'المسؤولية', 'العزلة'], publicationYear: 1818,
    sourcePageUrl: 'https://standardebooks.org/ebooks/mary-shelley/frankenstein', epubUrl: 'https://standardebooks.org/ebooks/mary-shelley/frankenstein/downloads/mary-shelley_frankenstein.epub?source=download', coverUrl: 'https://standardebooks.org/images/covers/mary-shelley_frankenstein/a2a4d948cd6d7eaa6bd1ce223fe17e4380689b5a/cover.jpg', sourceRepositoryUrl: 'https://github.com/standardebooks/mary-shelley_frankenstein',
    attribution: 'Standard Ebooks edition of Frankenstein by Mary Shelley. The Standard Ebooks edition is dedicated to the public domain via CC0; availability is verified for the United States.',
  },
  {
    provider: 'StandardEbooks', externalId: 'oscar-wilde_the-picture-of-dorian-gray', slug: 'oscar-wilde-the-picture-of-dorian-gray-standard-ebooks', title: 'The Picture of Dorian Gray', titleAr: 'صورة دوريان غراي',
    author: { slug: 'oscar-wilde', name: 'Oscar Wilde', nameAr: 'أوسكار وايلد', birthYear: 1854, deathYear: 1900, country: 'Ireland', countryAr: 'أيرلندا', bio: 'Irish writer, playwright, and poet associated with late nineteenth-century aestheticism.', bioAr: 'كاتب ومسرحي وشاعر أيرلندي ارتبط بالجمالية في أواخر القرن التاسع عشر.' },
    description: 'A philosophical novel about beauty, influence, conscience, and a portrait that bears the cost of corruption.', descriptionAr: 'رواية فلسفية عن الجمال والتأثير والضمير وبورتريه يتحمل ثمن الفساد.',
    genres: ['Classic', 'Gothic', 'Philosophical fiction'], genresAr: ['كلاسيكيات', 'قوطي', 'رواية فلسفية'], themes: ['Aestheticism', 'Conscience', 'Corruption'], themesAr: ['الجمالية', 'الضمير', 'الفساد'], publicationYear: 1890,
    sourcePageUrl: 'https://standardebooks.org/ebooks/oscar-wilde/the-picture-of-dorian-gray', epubUrl: 'https://standardebooks.org/ebooks/oscar-wilde/the-picture-of-dorian-gray/downloads/oscar-wilde_the-picture-of-dorian-gray.epub?source=download', coverUrl: 'https://standardebooks.org/images/covers/oscar-wilde_the-picture-of-dorian-gray/dd3646f331ad1bb43a4085a8a343cd57fd114d9b/cover.jpg', sourceRepositoryUrl: 'https://github.com/standardebooks/oscar-wilde_the-picture-of-dorian-gray',
    attribution: 'Standard Ebooks edition of The Picture of Dorian Gray by Oscar Wilde. The Standard Ebooks edition is dedicated to the public domain via CC0; availability is verified for the United States.',
  },
] as const;

interface ZipEntry { name: string; method: number; flags: number; compressedSize: number; uncompressedSize: number; localOffset: number; }
interface EpubChapter { title: string; content: string; }
export interface PreparedCatalogBook { manifest: StandardEbookManifest; epub: Buffer; epubChecksum: string; chapters: EpubChapter[]; cover: { body: Buffer; mimeType: string; checksum: string; sourceUrl: string; storageKey: string }; rights: RightsEvidence; }
export interface CatalogIngestionResult { id: string; slug: string; status: 'PUBLISHED' | 'REJECTED' | 'SKIPPED'; checksum?: string; chapters?: number; reason?: string; }

function normalized(value: string): string { return value.replace(/\s+/g, ' ').trim(); }
function textFromHtml(value: string): string {
  return normalized(value
    .replace(/<\/?(script|style|svg|nav|header|footer|aside)\b[^>]*>[\s\S]*?<\/(script|style|svg|nav|header|footer|aside)>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(nbsp|#160);/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>'));
}
function xmlAttribute(tag: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i').exec(tag);
  return match?.[2] || null;
}
function requireHttpsSource(value: string, label: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new CatalogQualityError('trusted-source', `${label} must be a valid HTTPS URL.`); }
  if (url.protocol !== 'https:' || url.username || url.password || !SOURCE_HOSTS.has(url.hostname)) throw new CatalogQualityError('trusted-source', `${label} is not hosted on the approved ${SOURCE_NAME} boundary.`, { url: value });
  return url;
}
function safeEntryName(value: string): string {
  const normalizedPath = posix.normalize(`/${value.replace(/\\/g, '/')}`).slice(1);
  if (!normalizedPath || normalizedPath.startsWith('../') || normalizedPath.includes('/../')) throw new CatalogQualityError('file-integrity', 'EPUB contains an unsafe entry path.');
  return normalizedPath;
}
function resolveEpubPath(base: string, relative: string): string {
  const clean = relative.split('#')[0].split('?')[0];
  return safeEntryName(posix.join(posix.dirname(base), clean));
}
function findEocd(data: Buffer): number {
  const start = Math.max(0, data.length - 65_557);
  for (let index = data.length - 22; index >= start; index -= 1) if (data.readUInt32LE(index) === 0x06054b50) return index;
  throw new CatalogQualityError('file-integrity', 'EPUB does not contain a ZIP end-of-central-directory record.');
}
function parseZip(data: Buffer): Map<string, ZipEntry> {
  if (data.length < 22) throw new CatalogQualityError('file-integrity', 'EPUB is truncated.');
  const eocd = findEocd(data); const entries = data.readUInt16LE(eocd + 10); const size = data.readUInt32LE(eocd + 12); const offset = data.readUInt32LE(eocd + 16);
  if (!entries || entries > 10_000 || offset + size > eocd) throw new CatalogQualityError('file-integrity', 'EPUB central directory is malformed.');
  const result = new Map<string, ZipEntry>(); let cursor = offset;
  for (let index = 0; index < entries; index += 1) {
    if (cursor + 46 > offset + size || data.readUInt32LE(cursor) !== 0x02014b50) throw new CatalogQualityError('file-integrity', 'EPUB has a malformed central-directory entry.');
    const compressedSize = data.readUInt32LE(cursor + 20); const uncompressedSize = data.readUInt32LE(cursor + 24); const nameLength = data.readUInt16LE(cursor + 28); const extraLength = data.readUInt16LE(cursor + 30); const commentLength = data.readUInt16LE(cursor + 32);
    const end = cursor + 46 + nameLength + extraLength + commentLength;
    if (end > offset + size) throw new CatalogQualityError('file-integrity', 'EPUB has a truncated central-directory entry.');
    const name = safeEntryName(data.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8'));
    if (result.has(name)) throw new CatalogQualityError('file-integrity', 'EPUB contains duplicate archive paths.');
    result.set(name, { name, flags: data.readUInt16LE(cursor + 8), method: data.readUInt16LE(cursor + 10), compressedSize, uncompressedSize, localOffset: data.readUInt32LE(cursor + 42) });
    cursor = end;
  }
  return result;
}
function readZipEntry(data: Buffer, entries: Map<string, ZipEntry>, name: string): Buffer {
  const entry = entries.get(safeEntryName(name));
  if (!entry) throw new CatalogQualityError('file-integrity', `EPUB required entry '${name}' is missing.`);
  if ((entry.flags & 0x01) !== 0 || (entry.flags & 0x08) !== 0) throw new CatalogQualityError('file-integrity', 'EPUB uses encrypted or streaming ZIP entries that are not accepted.');
  if (entry.localOffset + 30 > data.length || data.readUInt32LE(entry.localOffset) !== 0x04034b50) throw new CatalogQualityError('file-integrity', 'EPUB local ZIP entry is malformed.');
  const nameLength = data.readUInt16LE(entry.localOffset + 26); const extraLength = data.readUInt16LE(entry.localOffset + 28); const start = entry.localOffset + 30 + nameLength + extraLength; const end = start + entry.compressedSize;
  if (end > data.length || entry.uncompressedSize > 64 * 1024 * 1024) throw new CatalogQualityError('file-integrity', 'EPUB entry exceeds safe extraction limits.');
  const raw = data.subarray(start, end); let output: Buffer;
  if (entry.method === 0) output = Buffer.from(raw); else if (entry.method === 8) output = inflateRawSync(raw); else throw new CatalogQualityError('file-integrity', 'EPUB uses an unsupported compression method.');
  if (output.length !== entry.uncompressedSize) throw new CatalogQualityError('file-integrity', 'EPUB entry checksum/size verification failed.');
  return output;
}
function extractEpub(data: Buffer): { chapters: EpubChapter[]; cover: { body: Buffer; mimeType: string } } {
  const entries = parseZip(data);
  const container = readZipEntry(data, entries, 'META-INF/container.xml').toString('utf8');
  const opfPathMatch = /<rootfile\b[^>]*\bfull-path\s*=\s*["']([^"']+)["']/i.exec(container);
  if (!opfPathMatch?.[1]) throw new CatalogQualityError('chapters-readable', 'EPUB has no package document.');
  const opfPath = safeEntryName(opfPathMatch[1]); const opf = readZipEntry(data, entries, opfPath).toString('utf8');
  const manifest = new Map<string, { href: string; mediaType: string; properties: string }>();
  for (const match of opf.matchAll(/<item\b[^>]*>/gi)) {
    const tag = match[0]; const id = xmlAttribute(tag, 'id'); const href = xmlAttribute(tag, 'href'); const mediaType = xmlAttribute(tag, 'media-type') || ''; const properties = xmlAttribute(tag, 'properties') || '';
    if (id && href) manifest.set(id, { href, mediaType, properties });
  }
  const coverId = /<meta\b[^>]*\bname\s*=\s*["']cover["'][^>]*\bcontent\s*=\s*["']([^"']+)["']/i.exec(opf)?.[1];
  const coverItem = (coverId ? manifest.get(coverId) : undefined) || [...manifest.values()].find((item) => /\bcover-image\b/i.test(item.properties));
  if (!coverItem || !/^image\/(jpeg|png|webp)$/i.test(coverItem.mediaType)) throw new CatalogQualityError('metadata-complete', 'EPUB does not contain a readable cover image.');
  const cover = readZipEntry(data, entries, resolveEpubPath(opfPath, coverItem.href));
  if (cover.length < 1_024 || cover.length > MAX_COVER_BYTES) throw new CatalogQualityError('metadata-complete', 'EPUB cover image has an invalid size.');
  const spine = [...opf.matchAll(/<itemref\b[^>]*\bidref\s*=\s*["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
  const chapters: EpubChapter[] = [];
  for (const id of spine) {
    const item = manifest.get(id); if (!item || !/(application\/xhtml\+xml|text\/html)/i.test(item.mediaType)) continue;
    const html = readZipEntry(data, entries, resolveEpubPath(opfPath, item.href)).toString('utf8');
    if (/\b(?:doc-toc|toc|colophon|copyright-page)\b/i.test(html)) continue;
    const content = textFromHtml(html); if (content.length < MIN_CHAPTER_CHARACTERS) continue;
    const titleMarkup = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] || /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || `Chapter ${chapters.length + 1}`;
    const title = textFromHtml(titleMarkup).slice(0, 180) || `Chapter ${chapters.length + 1}`;
    chapters.push({ title, content });
  }
  if (chapters.length < MIN_CHAPTERS) throw new CatalogQualityError('chapters-readable', `EPUB yielded ${chapters.length} readable chapters; at least ${MIN_CHAPTERS} are required.`);
  return { chapters, cover: { body: cover, mimeType: coverItem.mediaType.toLowerCase() } };
}
function sizeFormatted(bytes: number): string { return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 2 : 1)} MB`; }
function rightsFor(manifest: StandardEbookManifest): RightsEvidence {
  return { rightsStatus: 'PUBLIC_DOMAIN', licenseType: 'CC0 1.0 Universal Public Domain Dedication (Standard Ebooks edition; availability verified in the United States)', evidence: `${manifest.sourcePageUrl} states that this ebook is thought to be free of copyright restrictions in the United States; ${manifest.sourceRepositoryUrl} provides the edition source.`, verificationMethod: 'LICENSE_DOCUMENT', territory: 'US', source: manifest.sourcePageUrl, attribution: manifest.attribution, verifiedAt: new Date().toISOString() };
}
function assertManifest(manifest: StandardEbookManifest): void {
  const required = [manifest.externalId, manifest.slug, manifest.title, manifest.titleAr, manifest.author.name, manifest.author.nameAr, manifest.description, manifest.descriptionAr, manifest.attribution, manifest.sourceRepositoryUrl];
  if (required.some((value) => !normalized(value))) throw new CatalogQualityError('metadata-complete', 'Required catalogue metadata is missing.');
  if (!Number.isInteger(manifest.publicationYear) || manifest.publicationYear < 1000 || manifest.publicationYear > new Date().getUTCFullYear()) throw new CatalogQualityError('metadata-complete', 'Publication year is not plausible.');
  requireHttpsSource(manifest.sourcePageUrl, 'Source page'); requireHttpsSource(manifest.epubUrl, 'EPUB URL'); requireHttpsSource(manifest.coverUrl, 'Cover URL');
  const repository = new URL(manifest.sourceRepositoryUrl); if (repository.protocol !== 'https:' || repository.hostname !== 'github.com') throw new CatalogQualityError('trusted-source', 'Source repository must be an approved HTTPS GitHub repository.');
}
async function approvedResponse(fetchFn: typeof fetch, stage: string, url: string, accept: string, maxBytes: number): Promise<Response> {
  requireHttpsSource(url, `${stage} URL`);
  const response = await providerFetch(fetchFn, SOURCE_NAME, stage, url, { headers: { accept, 'user-agent': USER_AGENT }, redirect: 'follow' }, { timeoutMs: 20_000 });
  if (!response.ok) throw new ProviderError(SOURCE_NAME, stage, `${SOURCE_NAME} returned HTTP ${response.status}.`, 502, { status: response.status });
  requireHttpsSource(response.url || url, `${stage} final URL`);
  const length = Number(response.headers.get('content-length') || '0');
  if (Number.isFinite(length) && (length < 1 || length > maxBytes)) throw new CatalogQualityError('file-present', `${stage} response has an invalid size.`, { bytes: length, maxBytes });
  return response;
}
async function sourceBytes(fetchFn: typeof fetch, stage: string, url: string, accept: string, maxBytes: number): Promise<Buffer> {
  const response = await approvedResponse(fetchFn, stage, url, accept, maxBytes);
  const data = Buffer.from(await response.arrayBuffer());
  if (!data.length || data.length > maxBytes) throw new CatalogQualityError('file-present', `${stage} response is empty or too large.`, { bytes: data.length, maxBytes });
  return data;
}
function jobStages(status: 'RUNNING' | 'PASSED' | 'FAILED', message: string, evidence?: Record<string, unknown>): IngestionStageRecord[] {
  const names: IngestionStageName[] = ['DISCOVERY', 'METADATA_NORMALIZATION', 'RIGHTS_VERIFICATION', 'CONTENT_ACQUISITION', 'FILE_VALIDATION', 'TEXT_EXTRACTION', 'CHAPTER_EXTRACTION', 'COVER_NORMALIZATION', 'METADATA_ENRICHMENT', 'PERSISTENCE', 'PUBLISHING'];
  return names.map((name) => ({ name, status: status === 'RUNNING' && name === 'DISCOVERY' ? 'RUNNING' : status === 'RUNNING' ? 'PENDING' : status, completedAt: status === 'RUNNING' ? undefined : new Date().toISOString(), message, evidence }));
}
function contentHash(chapters: EpubChapter[]): string { return createHash('sha256').update(chapters.map((chapter) => chapter.content).join('\n')).digest('hex'); }

export class InitialCatalogIngestor {
  private readonly catalog: MongoCatalogRepository;
  private readonly files = new MongoBookFileRepository(this.db);
  private readonly jobs = new MongoIngestionRepository(this.db);
  private readonly fileService: BookFileService;

  constructor(private readonly db: Db, private readonly storage: StorageProvider, options: { fetchFn?: typeof fetch; inspector?: UploadSecurityInspector } = {}) {
    this.catalog = new MongoCatalogRepository(db);
    this.fetchFn = options.fetchFn || fetch;
    this.fileService = new BookFileService(this.files, storage, () => Date.now(), options.inspector || new UploadSecurityInspector({ maxBytes: MAX_EPUB_BYTES }));
  }
  private readonly fetchFn: typeof fetch;

  async prepare(manifest: StandardEbookManifest): Promise<PreparedCatalogBook> {
    assertManifest(manifest);
    const sourcePage = (await sourceBytes(this.fetchFn, 'source-page', manifest.sourcePageUrl, 'text/html,application/xhtml+xml', 2 * 1024 * 1024)).toString('utf8').toLowerCase();
    if (!sourcePage.includes('free of copyright restrictions in the united states')) throw new CatalogQualityError('rights-verified', 'Source page does not contain the required US-rights statement.');
    if (!sourcePage.includes(new URL(manifest.epubUrl).pathname.toLowerCase())) throw new CatalogQualityError('file-present', 'Source page does not advertise the configured EPUB download.');
    const epub = await sourceBytes(this.fetchFn, 'epub', manifest.epubUrl, 'application/epub+zip,application/octet-stream', MAX_EPUB_BYTES);
    const extraction = extractEpub(epub);
    const cover = await sourceBytes(this.fetchFn, 'cover', manifest.coverUrl, 'image/jpeg,image/png,image/webp', MAX_COVER_BYTES);
    if (!/^\xff\xd8\xff|^\x89PNG\r\n\x1a\n|^RIFF....WEBP/s.test(cover.toString('latin1', 0, 16))) throw new CatalogQualityError('metadata-complete', 'Source cover is not a supported image.');
    // Source-page cover and embedded EPUB cover must both be present; source cover is the stable public display URL.
    if (!extraction.cover.body.length) throw new CatalogQualityError('metadata-complete', 'EPUB cover is empty.');
    return { manifest, epub, epubChecksum: checksumOf(epub), chapters: extraction.chapters, cover: { body: cover, mimeType: manifest.coverUrl.endsWith('.png') ? 'image/png' : manifest.coverUrl.endsWith('.webp') ? 'image/webp' : 'image/jpeg', checksum: checksumOf(cover), sourceUrl: manifest.coverUrl, storageKey: `catalog/covers/${manifest.slug}/${checksumOf(cover)}.${manifest.coverUrl.endsWith('.png') ? 'png' : manifest.coverUrl.endsWith('.webp') ? 'webp' : 'jpg'}` }, rights: rightsFor(manifest) };
  }

  private author(prepared: PreparedCatalogBook): Author {
    const { manifest } = prepared; const id = `author-standard-ebooks-${manifest.author.slug}`;
    return { id, slug: manifest.author.slug, name: manifest.author.name, nameAr: manifest.author.nameAr, avatar: manifest.coverUrl, birthYear: manifest.author.birthYear, deathYear: manifest.author.deathYear, era: '19th Century', eraAr: 'القرن التاسع عشر', country: manifest.author.country, countryAr: manifest.author.countryAr, bio: manifest.author.bio, bioAr: manifest.author.bioAr, timeline: [{ year: manifest.author.birthYear, event: `Born: ${manifest.author.name}`, eventAr: `الميلاد: ${manifest.author.nameAr}` }, { year: manifest.publicationYear, event: `Published: ${manifest.title}`, eventAr: `النشر: ${manifest.titleAr}` }], languages: ['en'], relatedAuthorIds: [], followersCount: 0 };
  }
  private book(prepared: PreparedCatalogBook): Book {
    const { manifest, chapters } = prepared; const authorId = `author-standard-ebooks-${manifest.author.slug}`; const bookId = `book-standard-ebooks-${manifest.externalId}`; const workId = `work-standard-ebooks-${manifest.externalId}`; const editionId = `edition-standard-ebooks-${manifest.externalId}`; const now = new Date().toISOString();
    const edition: BookEdition = { id: editionId, language: 'en', languageName: 'English', languageNameAr: 'الإنجليزية', publisher: SOURCE_NAME, publisherAr: 'ستاندرد إيبوكس', publicationYear: manifest.publicationYear, pageCount: Math.max(1, Math.ceil(chapters.reduce((total, chapter) => total + chapter.content.length, 0) / 2_000)), estimatedMinutes: Math.max(1, Math.ceil(chapters.reduce((total, chapter) => total + chapter.content.split(/\s+/).filter(Boolean).length, 0) / 220)), rightsStatus: 'PUBLIC_DOMAIN', licenseType: prepared.rights.licenseType, source: manifest.sourcePageUrl, attribution: manifest.attribution, territoryRestrictions: ['US'], files: [] };
    const mappedChapters: BookChapter[] = chapters.map((chapter, index) => ({ id: `chapter-${manifest.externalId}-${String(index + 1).padStart(3, '0')}`, title: chapter.title, titleAr: chapter.title, pageNumber: index + 1, content: chapter.content, contentAr: chapter.content }));
    return { id: bookId, workId, slug: manifest.slug, title: manifest.title, titleAr: manifest.titleAr, originalTitle: manifest.title, authorId, authorName: manifest.author.name, authorNameAr: manifest.author.nameAr, coverImage: manifest.coverUrl, description: manifest.description, descriptionAr: manifest.descriptionAr, genres: manifest.genres, genresAr: manifest.genresAr, categories: manifest.genres, categoriesAr: manifest.genresAr, themes: manifest.themes, themesAr: manifest.themesAr, moods: ['Contemplative'], rating: 0, ratingsCount: 0, reviewsCount: 0, downloadsCount: 0, readsCount: 0, featured: true, hiddenGem: false, editorialPick: true, forestRegion: 'archive-woods', forestCoords: { x: 30 + (manifest.externalId.length % 40), y: 30 + (manifest.title.length % 40) }, readingDifficulty: 'Moderate', primaryLanguage: 'en', publicationYear: manifest.publicationYear, editions: [edition], chapters: mappedChapters, chapterCount: mappedChapters.length, contentAvailability: 'FULL_TEXT', workflowStatus: 'FILE_VALIDATION', createdAt: now, updatedAt: now };
  }
  private work(prepared: PreparedCatalogBook, authorId: string) {
    const { manifest } = prepared;
    return { id: `work-standard-ebooks-${manifest.externalId}`, authorId, slug: `${manifest.slug}-work`, title: manifest.title, titleAr: manifest.titleAr, originalTitle: manifest.title, description: manifest.description, descriptionAr: manifest.descriptionAr, primaryLanguage: 'en', publicationYear: manifest.publicationYear };
  }
  private async upsertJob(job: IngestionJob): Promise<void> { const existing = await this.jobs.get(job.id); if (existing) await this.jobs.update(job); else await this.jobs.create(job); }
  private baseJob(manifest: StandardEbookManifest): IngestionJob {
    const now = new Date().toISOString(); return { id: `ingestion-p15-standard-ebooks-${manifest.externalId}`, provider: 'StandardEbooks', providerExternalId: manifest.externalId, requestedBy: INGESTOR_ID, requestedAt: now, status: 'DISCOVERED', stages: jobStages('RUNNING', 'P15 catalog ingestion started.'), createdAt: now, updatedAt: now };
  }
  private async persistRights(book: Book, rights: RightsEvidence): Promise<void> {
    const now = new Date().toISOString(); const editionId = book.editions[0].id; const id = `rights-p15-${book.id}-${editionId}`;
    await this.db.collection<RightsRecord>('rights_records').updateMany({ bookId: book.id, editionId, isCurrent: true, id: { $ne: id } }, { $set: { isCurrent: false, updatedAt: now } });
    const record: RightsRecord = { id, bookId: book.id, editionId, status: rights.rightsStatus, licenseType: rights.licenseType, source: rights.source, evidence: rights.evidence, verificationMethod: rights.verificationMethod, territory: rights.territory, attribution: rights.attribution, verifiedAt: rights.verifiedAt, isCurrent: true, createdAt: now, updatedAt: now };
    await this.db.collection<RightsRecord>('rights_records').replaceOne({ id }, record, { upsert: true });
  }
  private async persistCover(bookId: string, prepared: PreparedCatalogBook): Promise<void> {
    const existing = await this.storage.exists(prepared.cover.storageKey);
    if (existing) {
      const stored = await this.storage.get(prepared.cover.storageKey);
      if (stored.checksum !== prepared.cover.checksum || stored.sizeBytes !== prepared.cover.body.length) throw new CatalogQualityError('file-integrity', 'Existing cover object failed checksum verification.');
    } else {
      const stored = await this.storage.put({ storageKey: prepared.cover.storageKey, body: prepared.cover.body, mimeType: prepared.cover.mimeType, expectedChecksum: prepared.cover.checksum });
      if (stored.checksum !== prepared.cover.checksum || stored.sizeBytes !== prepared.cover.body.length) throw new CatalogQualityError('file-integrity', 'Cover storage checksum verification failed.');
    }
    const now = new Date().toISOString();
    await this.db.collection('catalog_assets').replaceOne({ id: `asset-cover-${bookId}` }, {
      id: `asset-cover-${bookId}`, bookId, kind: 'COVER', storageKey: prepared.cover.storageKey, mimeType: prepared.cover.mimeType, sizeBytes: prepared.cover.body.length, checksum: prepared.cover.checksum, sourceUrl: prepared.cover.sourceUrl, storageProvider: this.storage.name, createdAt: now, updatedAt: now,
    }, { upsert: true });
  }
  private async persist(prepared: PreparedCatalogBook): Promise<CatalogIngestionResult> {
    const author = this.author(prepared); const book = this.book(prepared); const edition = book.editions[0];
    await this.catalog.upsertAuthor(author); await this.catalog.upsertWork(this.work(prepared, author.id)); await this.catalog.upsertBookAggregate(book);
    await this.persistCover(book.id, prepared);
    const existing = (await this.files.list(book.id, edition.id)).find((file) => file.format === 'EPUB');
    if (existing && existing.checksum !== prepared.epubChecksum) throw new CatalogQualityError('file-integrity', 'A different EPUB checksum already exists for this edition; explicit editorial replacement is required.', { existingChecksum: existing.checksum, incomingChecksum: prepared.epubChecksum });
    const file = existing || await this.fileService.upload({ bookId: book.id, editionId: edition.id, format: 'EPUB' as FileFormat, mimeType: 'application/epub+zip', body: prepared.epub, originalName: `${prepared.manifest.externalId}.epub`, sourceUrl: prepared.manifest.epubUrl, downloadAllowed: true, readingAllowed: true, offlineAllowed: true }, { id: INGESTOR_ID, email: null, role: 'ADMIN', roles: ['ADMIN'], territory: 'US' });
    if (file.checksum !== prepared.epubChecksum || !file.verifiedAt || file.contentInspection !== 'PASSED') throw new CatalogQualityError('file-integrity', 'Stored EPUB did not retain the verified checksum and inspection state.');
    await this.persistRights(book, prepared.rights);
    const published = { ...book, workflowStatus: 'PUBLISHED' as const, updatedAt: new Date().toISOString() }; await this.catalog.upsertBookAggregate(published);
    return { id: book.id, slug: book.slug, status: 'PUBLISHED', checksum: file.checksum, chapters: book.chapters.length };
  }
  async ingest(manifest: StandardEbookManifest, options: { dryRun?: boolean } = {}): Promise<CatalogIngestionResult> {
    const job = this.baseJob(manifest); const existing = await this.jobs.get(job.id);
    if (existing?.status === 'PUBLISHED' && !options.dryRun) return { id: existing.candidateBookId || `book-standard-ebooks-${manifest.externalId}`, slug: manifest.slug, status: 'SKIPPED', checksum: existing.sourceFile?.sha256, chapters: existing.extractedChapters };
    await this.upsertJob(existing ? { ...existing, status: 'DISCOVERED', stages: jobStages('RUNNING', 'P15 catalog ingestion re-run started.'), updatedAt: new Date().toISOString(), failureReason: undefined } : job);
    try {
      const prepared = await this.prepare(manifest);
      const result = options.dryRun ? { id: `book-standard-ebooks-${manifest.externalId}`, slug: manifest.slug, status: 'PUBLISHED' as const, checksum: prepared.epubChecksum, chapters: prepared.chapters.length } : await this.persist(prepared);
      const completed: IngestionJob = { ...(await this.jobs.get(job.id))!, status: options.dryRun ? 'READY_FOR_REVIEW' : 'PUBLISHED', stages: jobStages('PASSED', options.dryRun ? 'P15 dry-run passed all quality rules; no data was published.' : 'P15 catalog record passed all rules and was published.', { checksum: prepared.epubChecksum, chapters: prepared.chapters.length, coverChecksum: prepared.cover.checksum }), normalizedMetadata: { title: manifest.title, author: manifest.author.name, edition: SOURCE_NAME, sourcePage: manifest.sourcePageUrl, sourceRepository: manifest.sourceRepositoryUrl }, rights: prepared.rights, sourceFile: { url: manifest.epubUrl, mimeType: 'application/epub+zip', bytes: prepared.epub.length, sha256: prepared.epubChecksum }, extractedText: { characters: prepared.chapters.reduce((total, chapter) => total + chapter.content.length, 0), sha256: contentHash(prepared.chapters) }, extractedChapters: prepared.chapters.length, coverUrl: manifest.coverUrl, candidateBookId: result.id, updatedAt: new Date().toISOString(), ...(options.dryRun ? {} : { publishedAt: new Date().toISOString() }) };
      await this.jobs.update(completed); return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown ingestion failure.'; const current = await this.jobs.get(job.id);
      if (current) await this.jobs.update({ ...current, status: error instanceof CatalogQualityError ? 'BLOCKED' : 'FAILED', stages: jobStages('FAILED', message, { code: error instanceof ApplicationError ? error.code : 'UNKNOWN' }), failureReason: message, updatedAt: new Date().toISOString() });
      return { id: `book-standard-ebooks-${manifest.externalId}`, slug: manifest.slug, status: 'REJECTED', reason: message };
    }
  }
  async run(manifests: readonly StandardEbookManifest[] = STANDARD_EBOOKS_LAUNCH_MANIFEST, options: { dryRun?: boolean; delayMs?: number } = {}): Promise<CatalogIngestionResult[]> {
    await applyP15CatalogMigration(this.db); if (this.storage.checkHealth) await this.storage.checkHealth();
    const results: CatalogIngestionResult[] = [];
    for (const manifest of manifests) { if (results.length && (options.delayMs ?? 1_500) > 0) await new Promise((resolve) => setTimeout(resolve, options.delayMs ?? 1_500)); results.push(await this.ingest(manifest, options)); }
    return results;
  }
}

export function summarizeCatalogResults(results: CatalogIngestionResult[]) {
  return { total: results.length, published: results.filter((result) => result.status === 'PUBLISHED').length, skipped: results.filter((result) => result.status === 'SKIPPED').length, rejected: results.filter((result) => result.status === 'REJECTED').length, results };
}
export { extractEpub };
