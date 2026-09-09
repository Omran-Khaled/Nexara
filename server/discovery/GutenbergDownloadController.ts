import { Request, Response } from 'express';
import { ValidationError } from '../errors/ApplicationErrors';
import { requirePrincipal } from '../middleware/auth';
import { GutenbergDownloadFormat, GutenbergDownloadService } from './GutenbergDownloadService';

function parseFormat(value: unknown): GutenbergDownloadFormat {
  if (value === 'txt' || value === 'html') return value;
  throw new ValidationError({ format: 'must be either txt or html.' });
}

export class GutenbergDownloadController {
  constructor(private readonly service: GutenbergDownloadService) {}

  download = async (req: Request, res: Response) => {
    requirePrincipal(req);
    const result = await this.service.download(req.params.id, parseFormat(req.query.format));
    res.setHeader('content-type', result.mimeType);
    res.setHeader('content-disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('cache-control', 'private, max-age=0, no-store');
    res.setHeader('x-nexara-source-url', result.sourceUrl);
    res.setHeader('x-nexara-source-title', encodeURIComponent(result.sourceTitle));
    res.status(200).send(result.data);
  };
}
