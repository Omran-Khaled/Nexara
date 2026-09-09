import { ExternalProviderError, NotFoundError, ProviderError, ValidationError } from '../errors/ApplicationErrors';
import { providerFetch } from './providerHttp';

export type GutenbergDownloadFormat = 'txt' | 'html';

interface GutenbergRecord {
  id: number;
  title: string;
  copyright: boolean | null;
  formats: Record<string, string>;
}

function xmlValue(xml: string, tag: string): string | null {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(xml);
  return match?.[1]?.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim() || null;
}

function opdsFormatUrl(xml: string, format: GutenbergDownloadFormat): string | null {
  const typePatterns = format === 'txt' ? ['text/plain', 'text/plain; charset=utf-8'] : ['text/html', 'text/html; charset=utf-8'];
  for (const type of typePatterns) {
    const escapedType = type.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
    const match = new RegExp(`<link[^>]+type="${escapedType}"[^>]+href="([^"]+)"`, 'i').exec(xml);
    if (match?.[1]) return match[1].replace(/&amp;/g, '&');
  }
  return null;
}

export interface DownloadedPublicDomainBook {
  filename: string;
  mimeType: 'text/plain; charset=utf-8' | 'text/html; charset=utf-8';
  data: Buffer;
  sourceUrl: string;
  sourceTitle: string;
}

const ACCEPTED_FORMATS: Record<GutenbergDownloadFormat, string[]> = {
  txt: ['text/plain; charset=utf-8', 'text/plain; charset=us-ascii', 'text/plain'],
  html: ['text/html; charset=utf-8', 'text/html'],
};

function approvedGutenbergHost(url: URL): boolean {
  return (url.hostname === 'gutenberg.org' || url.hostname === 'www.gutenberg.org') && !url.port && !url.username && !url.password;
}

function sourceHostAllowed(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && approvedGutenbergHost(url);
  } catch {
    return false;
  }
}

function normalizeApprovedGutenbergRedirect(location: string, currentUrl: string): string {
  let redirect: URL;
  try {
    redirect = new URL(location, currentUrl);
  } catch {
    throw new ProviderError('Gutenberg', 'file', 'The provider returned an invalid redirect destination.', 502);
  }
  if (!approvedGutenbergHost(redirect) || !['http:', 'https:'].includes(redirect.protocol)) {
    throw new ProviderError('Gutenberg', 'file', 'The provider attempted to redirect outside the approved host boundary.', 502);
  }
  // Gutenberg's canonical endpoint currently emits an HTTP hop before the HTTPS file URL.
  // Never fetch that downgrade: upgrade only its already allowlisted host in-process.
  redirect.protocol = 'https:';
  return redirect.toString();
}

async function fetchApprovedGutenbergFile(fetchFn: typeof fetch, sourceUrl: string): Promise<{ response: Response; finalUrl: string }> {
  let currentUrl = sourceUrl;
  for (let redirect = 0; redirect <= 4; redirect += 1) {
    const response = await providerFetch(fetchFn, 'Gutenberg', 'file', currentUrl, {
      headers: { 'user-agent': 'Nexara Digital Library (contact: admin@nexara.library)' },
      redirect: 'manual',
    }, { timeoutMs: 30_000, attempts: 5 });
    if (response.status < 300 || response.status >= 400) return { response, finalUrl: currentUrl };
    const location = response.headers.get('location');
    if (!location) throw new ProviderError('Gutenberg', 'file', 'The provider returned a redirect without a destination.', 502);
    const nextUrl = normalizeApprovedGutenbergRedirect(location, currentUrl);
    if (!sourceHostAllowed(nextUrl)) throw new ProviderError('Gutenberg', 'file', 'The provider attempted to redirect outside the approved HTTPS host boundary.', 502);
    currentUrl = nextUrl;
  }
  throw new ProviderError('Gutenberg', 'file', 'The provider exceeded the allowed redirect budget.', 502);
}
function filenamePart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80) || 'gutenberg-book';
}

export class GutenbergDownloadService {
  constructor(private readonly fetchFn: typeof fetch = fetch) {}

  async download(id: string, format: GutenbergDownloadFormat): Promise<DownloadedPublicDomainBook> {
    if (!/^\d{1,10}$/.test(id)) throw new ValidationError({ id: 'must be a valid Project Gutenberg numeric identifier.' });
    let title = `Gutenberg ${id}`;
    let sourceUrl: string | null = null;
    let verifiedPublicDomain = false;
    try {
      const catalogResponse = await providerFetch(this.fetchFn, 'Gutendex', 'catalog', `https://gutendex.com/books/${id}`, {
        headers: { 'user-agent': 'Nexara Digital Library (contact: admin@nexara.library)' },
      }, { timeoutMs: 12_000, attempts: 4 });
      if (catalogResponse.status === 404) throw new NotFoundError('Gutenberg book', id);
      if (catalogResponse.ok) {
        const record: unknown = await catalogResponse.json();
        if (!record || typeof record !== 'object') throw new ExternalProviderError('The public-domain catalog returned an invalid record.');
        const book = record as Partial<GutenbergRecord>;
        if (book.copyright !== false) throw new ValidationError({ rights: 'Only Gutendex records identified as public domain in the United States can be downloaded.' });
        verifiedPublicDomain = true;
        title = typeof book.title === 'string' ? book.title : title;
        const formats = book.formats && typeof book.formats === 'object' ? book.formats : {};
        sourceUrl = ACCEPTED_FORMATS[format].map((key) => formats[key]).find((value): value is string => typeof value === 'string' && sourceHostAllowed(value)) || null;
      }
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) throw error;
      // Gutendex can be rate-limited; use Gutenberg's official OPDS record only as a strict rights-verified fallback.
    }
    if (!sourceUrl) {
      const opdsResponse = await providerFetch(this.fetchFn, 'Gutenberg', 'opds', `https://www.gutenberg.org/ebooks/${id}.opds`, { headers: { 'user-agent': 'Nexara Digital Library' } }, { timeoutMs: 12_000, attempts: 4 });
      if (opdsResponse.status === 404) throw new NotFoundError('Gutenberg book', id);
      if (!opdsResponse.ok) throw new ProviderError('Gutenberg', 'opds', 'The public-domain catalog could not be reached.', 502, { status: opdsResponse.status });
      const opds = await opdsResponse.text();
      if (!/public domain in the usa/i.test(opds)) throw new ValidationError({ rights: 'The official Gutenberg record did not verify public-domain status in the United States.' });
      verifiedPublicDomain = true;
      title = xmlValue(opds, 'title') || title;
      sourceUrl = opdsFormatUrl(opds, format);
    }
    // After explicit rights verification, canonical Gutenberg endpoints are a safe fallback
    // for catalog records whose format labels cannot be parsed exactly.
    if (!sourceUrl && verifiedPublicDomain) sourceUrl = `https://www.gutenberg.org/ebooks/${id}.${format === 'txt' ? 'txt.utf-8' : 'html.images'}`;
    if (!sourceUrl || !sourceHostAllowed(sourceUrl)) throw new ValidationError({ format: `No safe ${format.toUpperCase()} file is available for this public-domain work.` });

    const { response, finalUrl } = await fetchApprovedGutenbergFile(this.fetchFn, sourceUrl);
    if (!response.ok || !sourceHostAllowed(finalUrl)) throw new ProviderError('Gutenberg', 'file', 'The requested public-domain file could not be retrieved safely.', 502, { status: response.status });
    const contentLength = Number(response.headers.get('content-length') || '0');
    if (!Number.isFinite(contentLength) || contentLength < 0 || contentLength > 12_000_000) throw new ValidationError({ file: 'The requested file exceeds the allowed download size.' });
    const data = Buffer.from(await response.arrayBuffer());
    if (data.byteLength === 0 || data.byteLength > 12_000_000) throw new ValidationError({ file: 'The requested file is empty or exceeds the allowed download size.' });
    return {
      filename: `${filenamePart(title)}-${id}.${format === 'txt' ? 'txt' : 'html'}`,
      mimeType: format === 'txt' ? 'text/plain; charset=utf-8' : 'text/html; charset=utf-8',
      data,
      sourceUrl: finalUrl,
      sourceTitle: title,
    };
  }
}
