import { Request, Response } from 'express';
import { BookFileService } from '../services/BookFileService';
import { RightsService } from '../services/LibraryServices';
import { requirePermission, requirePrincipal } from '../middleware/auth';
import { parseId } from '../utils/http';
import { AuthorizationError, ConflictError, ValidationError } from '../errors/ApplicationErrors';
import { FileFormat } from '../../src/types';
import { validateRights } from '../validators/libraryValidators';
import { BookService } from '../services/BookService';

export class BookFileController {
  constructor(
    private readonly service: BookFileService,
    private readonly rights: RightsService,
    private readonly accessUrlMaxSeconds = 300,
    /** Raw binary uploads are retained only for isolated test harnesses; real uploads must include rights via direct completion. */
    private readonly allowRawUpload = false,
    /** Upload policy ceiling for the development staged-body path. */
    private readonly maxUploadBytes = 104_857_600,
    private readonly books?: BookService,
  ) {}

  upload = async (req: Request, res: Response) => {
    if (!this.allowRawUpload) throw new ValidationError({ upload: 'raw binary upload is disabled; use the direct upload workflow with rights evidence.' });
    requirePermission(req, 'FILE_WRITE');
    const format = String(req.header('x-file-format') || '').toUpperCase() as FileFormat;
    const mimeType = req.header('content-type')?.split(';')[0].trim() || '';
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
    const originalName = req.header('x-file-name') || undefined;
    const record = await this.service.upload({ bookId: parseId(req.params.bookId, 'bookId'), editionId: parseId(req.params.editionId, 'editionId'), format, mimeType, body, originalName, sourceUrl: req.header('x-source-url') || undefined, downloadAllowed: req.header('x-download-allowed') !== 'false', readingAllowed: req.header('x-reading-allowed') !== 'false', offlineAllowed: req.header('x-offline-allowed') === 'true' }, requirePrincipal(req));
    res.status(201).json({ data: this.sanitize(record) });
  };

  createDirectUpload = async (req: Request, res: Response) => {
    requirePermission(req, 'FILE_WRITE');
    const body = (req.body || {}) as Record<string, unknown>;
    const data = await this.service.createDirectUploadUrl({
      bookId: parseId(req.params.bookId, 'bookId'),
      editionId: parseId(req.params.editionId, 'editionId'),
      format: String(body.format || '').toUpperCase() as FileFormat,
      mimeType: String(body.mimeType || ''),
    }, requirePrincipal(req));
    res.status(201).json({ data });
  };

  /**
   * Server-mediated staging step of the 'server' direct-upload mode (development
   * local storage). Bytes land in the same nexara-staging/ namespace the signed
   * browser PUT uses; the subsequent complete-direct-upload call applies the
   * identical validation, malware scan, integrity, rights, and rollback rules.
   */
  stagedBody = async (req: Request, res: Response) => {
    requirePermission(req, 'FILE_WRITE');
    const format = String(req.header('x-file-format') || '').toUpperCase() as FileFormat;
    if (!['PDF', 'EPUB', 'TXT', 'HTML'].includes(format)) {
      throw new ValidationError({ format: 'must be one of PDF, EPUB, TXT, HTML.' });
    }
    const mimeType = req.header('content-type')?.split(';')[0].trim() || '';
    if (!mimeType) throw new ValidationError({ mimeType: 'is required.' });
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
    if (!body.length) throw new ValidationError({ file: 'must not be empty.' });
    if (body.length > this.maxUploadBytes) {
      throw new ValidationError({ file: `exceeds the ${Math.floor(this.maxUploadBytes / 1_048_576)}MB storage policy.` });
    }
    res.status(201).json({ data: await this.service.stageDirectUploadBody({ format, mimeType, body }) });
  };

  completeDirectUpload = async (req: Request, res: Response) => {
    const principal = requirePermission(req, 'FILE_WRITE');
    const body = (req.body || {}) as Record<string, unknown>;
    const bookId = parseId(req.params.bookId, 'bookId');
    const editionId = parseId(req.params.editionId, 'editionId');
    const record = await this.service.completeDirectUpload({
      bookId,
      editionId,
      format: String(body.format || '').toUpperCase() as FileFormat,
      mimeType: String(body.mimeType || ''),
      temporaryStorageKey: String(body.temporaryStorageKey || ''),
      originalName: typeof body.originalName === 'string' ? body.originalName : undefined,
      sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl : undefined,
      downloadAllowed: body.downloadAllowed !== false,
      readingAllowed: body.readingAllowed !== false,
      offlineAllowed: body.offlineAllowed === true,
    }, principal);

    const rightsInput = (body.rights && typeof body.rights === 'object' ? body.rights as Record<string, unknown> : {});
    const automaticRights = await this.rights.resolveForDirectUpload(bookId, editionId, {
      ...rightsInput,
      verifiedAt: new Date().toISOString(),
    });
    const rights = validateRights({
      ...automaticRights,
      ...rightsInput,
      bookId,
      editionId,
      verifiedAt: new Date().toISOString(),
    });
    let rightsRecord;
    try {
      rightsRecord = await this.rights.create({
        ...rights,
        sourceFileSha256: record.checksum,
      }, principal.id);
    } catch (error) {
      if (!(error instanceof ConflictError)) {
        await this.service.discard(record);
        throw error;
      }
      const existing = (await this.rights.listByBook(bookId)).find((item) => item.editionId === editionId && item.isCurrent);
      if (!existing) {
        await this.service.discard(record);
        throw error;
      }
      rightsRecord = existing;
    }
    if (this.books) {
      await this.books.publishUploadedFile(bookId, editionId, record);
    }
    res.status(201).json({ data: { ...this.sanitize(record), rightsRecordId: rightsRecord.id } });
  };

  readUrl = async (req: Request, res: Response) => res.json({ data: await this.url(req, 'read') });
  /** @deprecated P6 requires the rights-authorized /downloads request endpoint. */
  downloadUrl = async (_req: Request, _res: Response) => { throw new AuthorizationError('Use the rights-authorized download request endpoint.'); };

  content = async (req: Request, res: Response) => {
    const principal = requirePrincipal(req); const file = await this.service.metadata(parseId(req.params.bookId, 'bookId'), parseId(req.params.editionId, 'editionId'), parseId(req.params.fileId, 'fileId'));
    const token = typeof req.query.token === 'string' ? req.query.token : ''; const mode = req.query.mode === 'download' ? 'download' : req.query.mode === 'read' ? 'read' : null; if (!mode) throw new ValidationError({ mode: 'must be read or download.' }); const object = await this.service.stream(file, token, principal, mode);
    const forceAttachment = mode === 'download' || file.format === 'HTML';
    res.setHeader('Content-Type', file.format === 'HTML' ? 'application/octet-stream' : file.mimeType);
    res.setHeader('Content-Length', String(object.sizeBytes));
    res.setHeader('ETag', `"${file.checksum}"`);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('X-Robots-Tag', 'noindex, noarchive');
    if (file.format === 'HTML') res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
    if (forceAttachment) res.setHeader('Content-Disposition', `attachment; filename="${file.id}.${file.format.toLowerCase()}"`);
    object.stream.pipe(res);
  };

  private url = async (req: Request, action: 'read' | 'download') => {
    const principal = requirePrincipal(req);
    const file = await this.service.metadata(parseId(req.params.bookId, 'bookId'), parseId(req.params.editionId, 'editionId'), parseId(req.params.fileId, 'fileId'));
    const expires = req.query.expiresInSeconds === undefined ? this.accessUrlMaxSeconds : Number(req.query.expiresInSeconds);
    if (!Number.isInteger(expires) || expires < 1 || expires > this.accessUrlMaxSeconds) throw new ValidationError({ expiresInSeconds: `must be an integer between 1 and ${this.accessUrlMaxSeconds} seconds.` });
    return this.service.createAccessUrl(file, principal, action, expires);
  };

  private sanitize(record: any) { const { storageKey: _storageKey, ...safe } = record; return safe; }
}
