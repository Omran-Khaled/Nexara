import { Request, Response } from 'express';
import { requireAdmin, requirePrincipal } from '../middleware/auth';
import { IngestionService } from '../services/IngestionService';
import { parseId } from '../utils/http';
import { ValidationError } from '../errors/ApplicationErrors';

function externalId(body: unknown): string {
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof (body as Record<string, unknown>).externalId !== 'string') throw new ValidationError({ externalId: 'is required.' });
  const value = (body as Record<string, unknown>).externalId;
  if (typeof value !== 'string' || !value.trim()) throw new ValidationError({ externalId: 'must be a non-empty string.' });
  return value.trim();
}

function language(body: unknown): string {
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof (body as Record<string, unknown>).language !== 'string') throw new ValidationError({ language: 'is required.' });
  const value = (body as Record<string, unknown>).language;
  if (typeof value !== 'string' || !/^[a-z]{2,12}$/i.test(value.trim())) throw new ValidationError({ language: 'must be a Wikisource language code.' });
  return value.trim().toLowerCase();
}

export class IngestionController {
  constructor(private readonly service: IngestionService) {}
  startGutenberg = async (req: Request, res: Response) => { requireAdmin(req); const job = await this.service.startGutenberg(externalId(req.body), requirePrincipal(req).id); res.status(201).json({ data: job }); };
  startWikisource = async (req: Request, res: Response) => { requireAdmin(req); const job = await this.service.startWikisource(externalId(req.body), language(req.body), requirePrincipal(req).id); res.status(201).json({ data: job }); };
  startAco = async (req: Request, res: Response) => { requireAdmin(req); const job = await this.service.startAco(externalId(req.body), requirePrincipal(req).id); res.status(201).json({ data: job }); };
  list = async (_req: Request, res: Response) => { res.json({ data: await this.service.list() }); };
  get = async (req: Request, res: Response) => { res.json({ data: await this.service.get(parseId(req.params.id)) }); };
  publish = async (req: Request, res: Response) => { requireAdmin(req); res.json({ data: await this.service.publish(parseId(req.params.id), requirePrincipal(req).id) }); };
}
