import { spawn } from 'node:child_process';
import { FileFormat } from '../../src/types';
import { ApplicationError, ValidationError } from '../errors/ApplicationErrors';

export const MIME_BY_FORMAT: Record<FileFormat, readonly string[]> = {
  PDF: ['application/pdf'],
  EPUB: ['application/epub+zip'],
  TXT: ['text/plain'],
  HTML: ['text/html', 'application/xhtml+xml'],
};

export const DEFAULT_MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const TEXT_SAMPLE_BYTES = 64 * 1024;
const HTML_SAMPLE_BYTES = 256 * 1024;
const FORBIDDEN_HTML = /<(?:script|iframe|object|embed|applet|base|meta\b[^>]*http-equiv\s*=\s*["']?refresh\b)/i;
const INLINE_EVENT_HANDLER = /\son[a-z0-9_-]+\s*=/i;

export type MalwareScanStatus = 'CLEAN' | 'NOT_CONFIGURED';

export interface MalwareScanner {
  readonly name: string;
  scan(body: Buffer): Promise<'CLEAN' | 'INFECTED'>;
  checkHealth?(): Promise<void>;
}

export interface FileInspection {
  checksumAlgorithm: 'sha256';
  malwareScanStatus: MalwareScanStatus;
  malwareScanner: string | null;
}

export interface UploadSecurityOptions {
  maxBytes?: number;
  malwareScanner?: MalwareScanner | null;
  requireMalwareScan?: boolean;
}

function utf8Sample(body: Buffer, maxBytes: number, field: 'file' | 'content'): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(body.subarray(0, Math.min(body.length, maxBytes)));
  } catch {
    throw new ValidationError({ [field]: 'must be valid UTF-8 text for the selected format.' });
  }
}

function assertSafeFilename(name: string | undefined, format: FileFormat): void {
  if (!name) return;
  if (name.length > 255 || /[\u0000-\u001f\\/]/.test(name) || name === '.' || name === '..' || name.includes('..')) {
    throw new ValidationError({ filename: 'must be a safe basename without path characters.' });
  }
  const extension = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toUpperCase() : '';
  if (extension !== format) throw new ValidationError({ filename: `extension must match the selected ${format} format.` });
}

function assertPdf(body: Buffer): void {
  if (body.length < 8 || !body.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    throw new ValidationError({ file: 'does not contain a valid PDF signature.' });
  }
  const trailer = body.subarray(Math.max(0, body.length - 2048)).toString('latin1');
  if (!trailer.includes('%%EOF')) throw new ValidationError({ file: 'does not contain a complete PDF trailer.' });
}

const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const MAX_EPUB_ENTRIES = 10_000;
const MAX_EPUB_UNCOMPRESSED_BYTES = 512 * 1024 * 1024;
const MAX_EPUB_COMPRESSION_RATIO = 100;

function eocdOffset(body: Buffer): number {
  const start = Math.max(0, body.length - 65_557);
  for (let offset = body.length - 22; offset >= start; offset -= 1) {
    if (body.readUInt32LE(offset) === ZIP_END_OF_CENTRAL_DIRECTORY) return offset;
  }
  return -1;
}

function safeZipEntryName(value: string): boolean {
  // EPUB ZIP archives legitimately contain directory entries such as `META-INF/`.
  // Permit one trailing slash only; all material path segments must remain non-empty and non-traversing.
  const material = value.endsWith('/') ? value.slice(0, -1) : value;
  return Boolean(material) && !material.startsWith('/') && !material.startsWith('\\\\') && !material.split('/').some((part) => part === '..' || part === '');
}

function assertEpub(body: Buffer): void {
  if (body.length < 22 || body.readUInt32LE(0) !== ZIP_LOCAL_FILE_HEADER) {
    throw new ValidationError({ file: 'does not contain a valid ZIP/EPUB signature.' });
  }
  const firstFlags = body.readUInt16LE(6);
  const firstMethod = body.readUInt16LE(8);
  const firstSize = body.readUInt32LE(18);
  const firstNameLength = body.readUInt16LE(26);
  const firstExtraLength = body.readUInt16LE(28);
  const firstNameStart = 30;
  const firstDataStart = firstNameStart + firstNameLength + firstExtraLength;
  const firstDataEnd = firstDataStart + firstSize;
  if ((firstFlags & 0x08) !== 0 || firstMethod !== 0 || firstDataEnd > body.length || body.subarray(firstNameStart, firstNameStart + firstNameLength).toString('utf8') !== 'mimetype' || body.subarray(firstDataStart, firstDataEnd).toString('ascii') !== 'application/epub+zip') {
    throw new ValidationError({ file: 'does not contain the required uncompressed EPUB mimetype entry.' });
  }

  const eocd = eocdOffset(body);
  if (eocd < 0 || eocd + 22 > body.length) throw new ValidationError({ file: 'does not contain a ZIP central directory.' });
  const disk = body.readUInt16LE(eocd + 4);
  const centralDisk = body.readUInt16LE(eocd + 6);
  const diskEntries = body.readUInt16LE(eocd + 8);
  const entries = body.readUInt16LE(eocd + 10);
  const centralSize = body.readUInt32LE(eocd + 12);
  const centralOffset = body.readUInt32LE(eocd + 16);
  if (disk !== 0 || centralDisk !== 0 || diskEntries !== entries || entries < 1 || entries > MAX_EPUB_ENTRIES || centralOffset + centralSize > eocd) {
    throw new ValidationError({ file: 'contains an unsupported or malformed EPUB ZIP directory.' });
  }

  let cursor = centralOffset;
  let totalUncompressed = 0;
  for (let index = 0; index < entries; index += 1) {
    if (cursor + 46 > centralOffset + centralSize || body.readUInt32LE(cursor) !== ZIP_CENTRAL_DIRECTORY_HEADER) throw new ValidationError({ file: 'contains a malformed EPUB ZIP entry.' });
    const compressedSize = body.readUInt32LE(cursor + 20);
    const uncompressedSize = body.readUInt32LE(cursor + 24);
    const nameLength = body.readUInt16LE(cursor + 28);
    const extraLength = body.readUInt16LE(cursor + 30);
    const commentLength = body.readUInt16LE(cursor + 32);
    const nameStart = cursor + 46;
    const next = nameStart + nameLength + extraLength + commentLength;
    if (next > centralOffset + centralSize) throw new ValidationError({ file: 'contains a truncated EPUB ZIP entry.' });
    const name = body.subarray(nameStart, nameStart + nameLength).toString('utf8');
    if (!safeZipEntryName(name)) throw new ValidationError({ file: 'contains an unsafe EPUB archive path.' });
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_EPUB_UNCOMPRESSED_BYTES || (compressedSize === 0 ? uncompressedSize !== 0 : uncompressedSize / compressedSize > MAX_EPUB_COMPRESSION_RATIO)) {
      throw new ValidationError({ file: 'exceeds EPUB archive expansion safety limits.' });
    }
    cursor = next;
  }
  if (cursor !== centralOffset + centralSize) throw new ValidationError({ file: 'contains unexpected EPUB ZIP directory data.' });
}

function assertText(body: Buffer): void {
  const text = utf8Sample(body, TEXT_SAMPLE_BYTES, 'file');
  if (text.includes('\u0000')) throw new ValidationError({ file: 'contains NUL bytes and is not accepted as plain text.' });
  const controls = [...text].filter((character) => {
    const code = character.codePointAt(0) || 0;
    return code < 32 && character !== '\n' && character !== '\r' && character !== '\t' && character !== '\f';
  }).length;
  if (text.length > 0 && controls / text.length > 0.01) throw new ValidationError({ file: 'contains excessive binary control characters.' });
}

function assertHtml(body: Buffer): void {
  const html = utf8Sample(body, HTML_SAMPLE_BYTES, 'content');
  if (!/<(?:!doctype\s+html|html|head|body)\b/i.test(html)) throw new ValidationError({ file: 'does not contain an HTML document root.' });
  if (FORBIDDEN_HTML.test(html) || INLINE_EVENT_HANDLER.test(html)) {
    throw new ValidationError({ file: 'contains active HTML that is not permitted in stored reading content.' });
  }
}

function assertMagicBytes(format: FileFormat, body: Buffer): void {
  if (format === 'PDF') return assertPdf(body);
  if (format === 'EPUB') return assertEpub(body);
  if (format === 'TXT') return assertText(body);
  return assertHtml(body);
}

export class ClamDScanMalwareScanner implements MalwareScanner {
  readonly name = 'clamdscan';
  constructor(private readonly timeoutMs = 30_000) {}

  async checkHealth(): Promise<void> {
    const result = await this.scan(Buffer.from('nexara-malware-readiness-probe', 'utf8'));
    if (result !== 'CLEAN') throw new Error('malware scanner readiness probe was not clean');
  }

  scan(body: Buffer): Promise<'CLEAN' | 'INFECTED'> {
    return new Promise((resolve, reject) => {
      const child = spawn('clamdscan', ['--no-summary', '--stream'], { stdio: ['pipe', 'ignore', 'pipe'], shell: false });
      let stderr = '';
      let settled = false;
      const finish = (error?: Error, result?: 'CLEAN' | 'INFECTED') => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error); else resolve(result || 'CLEAN');
      };
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        finish(new Error('malware scanner timed out'));
      }, this.timeoutMs);
      child.on('error', (error) => finish(error));
      child.stderr.on('data', (chunk: Buffer) => { if (stderr.length < 4096) stderr += chunk.toString('utf8'); });
      child.on('close', (code) => {
        if (code === 0) return finish(undefined, 'CLEAN');
        if (code === 1) return finish(undefined, 'INFECTED');
        finish(new Error(`malware scanner exited with code ${String(code)}${stderr ? `: ${stderr.trim().slice(0, 512)}` : ''}`));
      });
      child.stdin.on('error', (error) => finish(error));
      child.stdin.end(body);
    });
  }
}

/**
 * Adapter for a dedicated malware-scanning service. The service must expose:
 * - GET /health returning 2xx when ClamAV is ready;
 * - POST /scan accepting application/octet-stream and returning { status: 'CLEAN' | 'INFECTED' }.
 * The optional bearer token belongs to server-side deployment configuration only.
 */
export class HttpMalwareScanner implements MalwareScanner {
  readonly name = 'remote-http';
  constructor(private readonly baseUrl: string, private readonly token: string | null = null, private readonly timeoutMs = 15_000) {}

  private headers(contentType?: string): HeadersInit {
    return {
      ...(contentType ? { 'content-type': contentType } : {}),
      ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
    };
  }

  async checkHealth(): Promise<void> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/health`, { headers: this.headers(), signal: AbortSignal.timeout(this.timeoutMs) });
    if (!response.ok) throw new Error(`remote malware scanner health check returned HTTP ${response.status}`);
  }

  async scan(body: Buffer): Promise<'CLEAN' | 'INFECTED'> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/scan`, { method: 'POST', headers: this.headers('application/octet-stream'), body, signal: AbortSignal.timeout(this.timeoutMs) });
    if (!response.ok) throw new Error(`remote malware scanner returned HTTP ${response.status}`);
    const result = await response.json() as { status?: unknown };
    if (result.status === 'CLEAN' || result.status === 'INFECTED') return result.status;
    throw new Error('remote malware scanner returned an invalid result');
  }
}

export class UploadSecurityInspector {
  private readonly maxBytes: number;
  private readonly scanner: MalwareScanner | null;
  private readonly requireMalwareScan: boolean;

  constructor(options: UploadSecurityOptions = {}) {
    this.maxBytes = options.maxBytes || DEFAULT_MAX_UPLOAD_BYTES;
    this.scanner = options.malwareScanner || null;
    this.requireMalwareScan = options.requireMalwareScan || false;
  }

  async checkHealth(): Promise<void> {
    if (!this.requireMalwareScan) return;
    if (!this.scanner) throw new ApplicationError('MALWARE_SCANNER_UNAVAILABLE', 503, 'The malware scanner is required but is not configured.');
    if (this.scanner.checkHealth) { await this.scanner.checkHealth(); return; }
    const result = await this.scanner.scan(Buffer.from('nexara-malware-readiness-probe', 'utf8'));
    if (result !== 'CLEAN') throw new ApplicationError('MALWARE_SCANNER_UNAVAILABLE', 503, 'The malware scanner readiness probe did not complete cleanly.');
  }

  async inspect(input: { format: FileFormat; mimeType: string; body: Buffer; originalName?: string }): Promise<FileInspection> {
    if (!MIME_BY_FORMAT[input.format]?.includes(input.mimeType)) {
      throw new ValidationError({ mimeType: 'does not match the selected file format.' });
    }
    if (!Buffer.isBuffer(input.body) || input.body.length === 0) throw new ValidationError({ file: 'must be a non-empty binary payload.' });
    if (input.body.length > this.maxBytes) throw new ApplicationError('PAYLOAD_TOO_LARGE', 413, 'The uploaded file exceeds the permitted size.');
    assertSafeFilename(input.originalName, input.format);
    assertMagicBytes(input.format, input.body);

    if (!this.scanner) {
      if (this.requireMalwareScan) throw new ApplicationError('MALWARE_SCANNER_UNAVAILABLE', 503, 'The malware scanner is required but is not configured.');
      return { checksumAlgorithm: 'sha256', malwareScanStatus: 'NOT_CONFIGURED', malwareScanner: null };
    }

    try {
      const result = await this.scanner.scan(input.body);
      if (result === 'INFECTED') throw new ApplicationError('MALWARE_DETECTED', 422, 'The uploaded file was rejected by malware scanning.');
      return { checksumAlgorithm: 'sha256', malwareScanStatus: 'CLEAN', malwareScanner: this.scanner.name };
    } catch (error) {
      if (error instanceof ApplicationError) throw error;
      throw new ApplicationError('MALWARE_SCANNER_UNAVAILABLE', 503, 'The malware scanner could not inspect the uploaded file.');
    }
  }
}

export function allowedUploadMimeTypes(): readonly string[] {
  return Object.values(MIME_BY_FORMAT).flat();
}
