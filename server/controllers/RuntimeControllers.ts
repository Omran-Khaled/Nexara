import { Request, Response } from 'express';
import { requirePrincipal } from '../middleware/auth';
import { RuntimeService } from '../services/RuntimeServices';
import { parseId } from '../utils/http';

export class RuntimeController {
  constructor(private readonly service: RuntimeService) {}

  listAuthors = async (_req: Request, res: Response) => res.json({ data: await this.service.listAuthors() });
  listReadingPaths = async (_req: Request, res: Response) => res.json({ data: await this.service.listReadingPaths() });
  listPersonal = async (req: Request, res: Response) => res.json({ data: await this.service.listPersonal(requirePrincipal(req).id) });
  upsertBookState = async (req: Request, res: Response) => res.json({ data: await this.service.upsertBookState(requirePrincipal(req).id, req.body) });
  createTimeCapsule = async (req: Request, res: Response) => res.status(201).json({ data: await this.service.createTimeCapsule(requirePrincipal(req).id, req.body) });
  markNotificationRead = async (req: Request, res: Response) => res.json({ data: await this.service.markNotificationRead(requirePrincipal(req).id, parseId(req.params.id)) });
}
