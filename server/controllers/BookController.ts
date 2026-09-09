import { Request, Response } from 'express';
import { BookService } from '../services/BookService';
import { parseId, parsePage } from '../utils/http';
import { validateBookPatch, validateBookWrite } from '../validators/bookValidators';
import { requirePermission } from '../middleware/auth';
import { ConflictError } from '../errors/ApplicationErrors';

export class BookController {
  constructor(private readonly service: BookService) {}

  list = async (req: Request, res: Response) => {
    const page = parsePage(req.query as Record<string, unknown>);
    const result = await this.service.list({
      query: typeof req.query.query === 'string' ? req.query.query : undefined,
      contentAvailability: typeof req.query.contentAvailability === 'string' ? req.query.contentAvailability as any : undefined,
      workflowStatus: typeof req.query.workflowStatus === 'string' ? req.query.workflowStatus as any : undefined,
    }, page);
    res.json(result);
  };

  get = async (req: Request, res: Response) => {
    const book = await this.service.get(parseId(req.params.id));
    res.json({ data: book });
  };

  getChapter = async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const index = Number(req.params.index);
    if (!Number.isInteger(index) || index < 0) throw new ConflictError('Chapter index must be a non-negative integer.');
    res.json({ data: await this.service.getChapter(id, index), index });
  };

  create = async (req: Request, res: Response) => {
    requirePermission(req, 'CATALOG_WRITE');
    const input = validateBookWrite(req.body);
    if (input.workflowStatus === 'PUBLISHED') throw new ConflictError('Direct catalogue creation cannot publish a book. Use the ingestion pipeline after metadata, rights, file, and content validation.');
    const book = await this.service.create(input);
    res.status(201).json({ data: book });
  };

  update = async (req: Request, res: Response) => {
    requirePermission(req, 'CATALOG_WRITE');
    const patch = validateBookPatch(req.body);
    if (patch.workflowStatus === 'PUBLISHED') throw new ConflictError('Direct publication is blocked. Publish only through a completed ingestion job.');
    const book = await this.service.update(parseId(req.params.id), patch);
    res.json({ data: book });
  };

  delete = async (req: Request, res: Response) => {
    requirePermission(req, 'CATALOG_WRITE');
    await this.service.delete(parseId(req.params.id));
    res.status(204).send();
  };
}
