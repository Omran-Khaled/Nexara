import { Request, Response } from 'express';
import { requirePrincipal } from '../middleware/auth';
import { DownloadService } from '../services/DownloadService';
import { parseId } from '../utils/http';
import { ValidationError } from '../errors/ApplicationErrors';

export class DownloadController {
  constructor(private readonly service: DownloadService) {}

  availability = async (req: Request, res: Response) => {
    const principal = requirePrincipal(req);
    const data = await this.service.availability(
      parseId(req.params.bookId, 'bookId'),
      parseId(req.params.editionId, 'editionId'),
      principal,
    );
    res.json({ data });
  };

  requestDownload = async (req: Request, res: Response) => {
    const principal = requirePrincipal(req);
    const expiresInSeconds = req.body?.expiresInSeconds === undefined ? undefined : Number(req.body.expiresInSeconds);
    if (expiresInSeconds !== undefined && (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > 3600)) {
      throw new ValidationError({ expiresInSeconds: 'must be an integer between 1 and 3600 seconds.' });
    }
    const data = await this.service.authorizeDownload({
      bookId: parseId(req.params.bookId, 'bookId'),
      editionId: parseId(req.params.editionId, 'editionId'),
      fileId: parseId(req.params.fileId, 'fileId'),
      principal,
      expiresInSeconds,
      requestId: req.header('x-request-id') || undefined,
    });
    res.status(201).json({ data });
  };
}
