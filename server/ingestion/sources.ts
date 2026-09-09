import { ValidationError } from '../errors/ApplicationErrors';
import { GutenbergDownloadService } from '../discovery/GutenbergDownloadService';
import { providerFetch } from '../discovery/providerHttp';
import { IngestionSourceRecord } from '../models/ingestion';
import { approvedUrl, fetchApproved, iso, MAX_SOURCE_BYTES, pageTitle, plainHtml, readIngestionBody } from './helpers';

export interface IngestionSourceGateway {
  acquireGutenberg(externalId: string): Promise<IngestionSourceRecord>;
  acquireWikisource?(externalId: string, language: string): Promise<IngestionSourceRecord>;
  acquireAco?(externalId: string): Promise<IngestionSourceRecord>;
}

interface GutendexRecord {
  id: number;
  title: string;
  authors?: Array<{ name?: string }>;
  subjects?: string[];
  languages?: string[];
  copyright?: boolean | null;
  formats?: Record<string, string>;
  bookshelves?: string[];
}

interface WikiResponse {
  parse?: { title?: string; revid?: number; text?: { '*': string }; categories?: Array<{ '*': string }> };
}

/**
 * Source acquisition adapters. Each adapter accepts only official source hosts
 * and explicit, provider-asserted rights evidence before a candidate may enter
 * administrator review.
 */
export class GutenbergIngestionSourceGateway implements IngestionSourceGateway {
  constructor(private readonly downloads = new GutenbergDownloadService(), private readonly fetchFn: typeof fetch = fetch) {}

  async acquireGutenberg(externalId: string): Promise<IngestionSourceRecord> {
    if (!/^\d{1,10}$/.test(externalId)) throw new ValidationError({ externalId: 'must be a Project Gutenberg numeric identifier.' });
    // House provider transport (bounded transient-fault retry, GET-only) instead of a
    // raw fetch: gutendex metadata previously died on a single TCP reset (ECONNRESET).
    const response = await providerFetch(
      this.fetchFn,
      'Gutendex',
      'metadata',
      `https://gutendex.com/books/${externalId}`,
      { headers: { 'user-agent': 'Nexara Digital Library reviewed ingestion' } },
      { timeoutMs: 20_000, attempts: 5 },
    );
    if (!response.ok) throw new ValidationError({ discovery: `Gutendex metadata could not be acquired (HTTP ${response.status}).` });
    const raw = await response.json() as GutendexRecord;
    if (!raw || typeof raw.title !== 'string' || raw.copyright !== false) throw new ValidationError({ rights: 'Gutendex must explicitly identify the record as public domain; publication year is never used as rights evidence.' });
    const downloaded = await this.downloads.download(externalId, 'txt');
    if (downloaded.data.byteLength > MAX_SOURCE_BYTES) throw new ValidationError({ file: 'The Gutenberg source exceeds the 50 MB import limit.' });
    const permalink = `https://www.gutenberg.org/ebooks/${externalId}`;
    const authors = (raw.authors || []).map((author) => author.name?.trim()).filter((value): value is string => Boolean(value));
    return {
      provider: 'Gutenberg',
      externalId: String(raw.id || externalId),
      title: raw.title.trim(),
      authors: authors.length ? authors : ['Unknown author'],
      subjects: [...(raw.subjects || []), ...(raw.bookshelves || [])].filter(Boolean).slice(0, 12),
      language: raw.languages?.[0] || 'en',
      coverUrl: typeof raw.formats?.['image/jpeg'] === 'string' ? raw.formats['image/jpeg'] : undefined,
      sourceUrl: permalink,
      rights: {
        rightsStatus: 'PUBLIC_DOMAIN',
        licenseType: 'Project Gutenberg public-domain distribution',
        evidence: `Gutendex record ${externalId} returned copyright=false; content was acquired from ${downloaded.sourceUrl}.`,
        verificationMethod: 'PROVIDER_ASSERTION',
        territory: 'US',
        source: downloaded.sourceUrl,
        attribution: `Source text from Project Gutenberg, eBook #${externalId}.`,
        verifiedAt: iso(),
        permalink,
        rightsEvidenceUrl: permalink,
      },
      content: { data: downloaded.data, mimeType: downloaded.mimeType, sourceUrl: downloaded.sourceUrl },
    };
  }

  async acquireWikisource(externalId: string, language: string): Promise<IngestionSourceRecord> {
    const lang = language.trim().toLowerCase();
    if (!/^[a-z]{2,12}$/.test(lang)) throw new ValidationError({ language: 'must be a valid Wikisource language subdomain.' });
    if (!externalId.trim() || externalId.length > 240) throw new ValidationError({ externalId: 'must be a Wikisource page title no longer than 240 characters.' });
    const title = externalId.trim();
    const canonical = `https://${lang}.wikisource.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
    const api = new URL(`https://${lang}.wikisource.org/w/api.php`);
    api.search = new URLSearchParams({ action: 'parse', page: title, prop: 'text|categories|displaytitle|revid', format: 'json', formatversion: '2', origin: '*' }).toString();
    const parsed = JSON.parse((await readIngestionBody(await fetchApproved(api.toString(), 'application/json'), 'discovery')).toString('utf8')) as WikiResponse;
    const html = parsed.parse?.text?.['*'];
    if (!parsed.parse?.title || typeof html !== 'string') throw new ValidationError({ discovery: 'Wikisource did not return a readable page for this title.' });
    const content = plainHtml(html);
    if (content.length < 400) throw new ValidationError({ content: 'The Wikisource page does not contain enough readable text to form a book.' });
    const marker = html.toLowerCase();
    const isPublicDomain = /public\s+domain|domain\s+public|\u0645\u0644\u0643\u064a\u0629\s+\u0639\u0627\u0645\u0629|\u0627\u0644\u0645\u062c\u0627\u0644\s+\u0627\u0644\u0639\u0627\u0645/.test(marker);
    const isCcBySa = /cc\s*by[\s-]*sa|cc-by-sa|creative\s+commons[^<]{0,80}share\s*alike/.test(marker);
    if (!isPublicDomain && !isCcBySa) throw new ValidationError({ rights: 'Wikisource page lacks an explicit public-domain or CC BY-SA rights indication.' });
    const permalink = parsed.parse.revid ? `${canonical}?oldid=${parsed.parse.revid}` : canonical;
    const licenseType = isPublicDomain ? 'Public domain as indicated on the Wikisource work page' : 'CC BY-SA as indicated on the Wikisource work page';
    return {
      provider: 'Wikisource',
      externalId: parsed.parse.title,
      title: plainHtml(parsed.parse.title),
      authors: ['Unknown author'],
      subjects: (parsed.parse.categories || []).map((item) => plainHtml(item['*'])).filter(Boolean).slice(0, 12),
      language: lang,
      sourceUrl: canonical,
      rights: {
        rightsStatus: isPublicDomain ? 'PUBLIC_DOMAIN' : 'LICENSED',
        licenseType,
        evidence: `The work page explicitly indicates ${isPublicDomain ? 'public-domain' : 'CC BY-SA'} reuse status.`,
        verificationMethod: 'LICENSE_DOCUMENT',
        territory: 'GLOBAL',
        source: canonical,
        attribution: `Source text from Wikisource: ${parsed.parse.title}. ${licenseType}.`,
        verifiedAt: iso(),
        permalink,
        rightsEvidenceUrl: permalink,
      },
      content: { data: Buffer.from(content, 'utf8'), mimeType: 'text/plain; charset=utf-8', sourceUrl: permalink },
    };
  }

  async acquireAco(externalId: string): Promise<IngestionSourceRecord> {
    if (!/^[a-z0-9][a-z0-9_-]{2,120}$/i.test(externalId)) throw new ValidationError({ externalId: 'must be an ACO title identifier such as columbia_aco001050.' });
    const permalink = `https://aco.dlib.nyu.edu/book/${encodeURIComponent(externalId)}/1`;
    const source = (await readIngestionBody(await fetchApproved(permalink, 'text/html,application/xhtml+xml'), 'discovery')).toString('utf8');
    const title = pageTitle(source);
    if (!title) throw new ValidationError({ discovery: 'ACO did not return a title page for this identifier.' });
    const links = Array.from(source.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi)).map((match) => match[1]);
    const pdf = links
      .map((link) => { try { return new URL(link, permalink); } catch { return null; } })
      .find((url): url is URL => Boolean(url) && url.protocol === 'https:' && (url.hostname === 'aco.dlib.nyu.edu' || url.hostname === 'dlib.nyu.edu') && (/\.pdf(?:$|[?#])/i.test(url.pathname) || /download/i.test(url.pathname)));
    if (!pdf) throw new ValidationError({ content: 'The ACO title page must expose an official HTTPS PDF link before a durable import can be reviewed.' });
    const file = await readIngestionBody(await fetchApproved(pdf.toString(), 'application/pdf'), 'content');
    if (file.length < 8 || !file.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new ValidationError({ file: 'The ACO download is not a valid PDF document.' });
    return {
      provider: 'ArabicCollectionsOnline',
      externalId,
      title,
      authors: ['Unknown author'],
      subjects: [],
      language: 'ar',
      sourceUrl: permalink,
      rights: {
        rightsStatus: 'PUBLIC_DOMAIN',
        licenseType: 'ACO public-domain Arabic-language content',
        evidence: 'ACO states that it provides public-domain Arabic-language content; the title page and official PDF were acquired for administrator review.',
        verificationMethod: 'PROVIDER_ASSERTION',
        territory: 'GLOBAL',
        source: permalink,
        attribution: `Source scan from Arabic Collections Online (ACO), identifier ${externalId}.`,
        verifiedAt: iso(),
        permalink,
        rightsEvidenceUrl: 'https://aco.dlib.nyu.edu/about',
      },
      content: { data: file, mimeType: 'application/pdf', sourceUrl: pdf.toString() },
    };
  }
}

export type { IngestionSourceRecord };