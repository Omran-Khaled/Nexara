import { Request, Response } from 'express';
import { ApplicationError } from '../errors/ApplicationErrors';
import { DiscoveryService } from './DiscoveryService';

export class DiscoveryController {
  constructor(private readonly service: DiscoveryService) {}
  search = async (req: Request, res: Response) => {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const page = typeof req.query.page === 'string' ? Number(req.query.page) : 1;
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 20;
    if (!query.trim()) throw new ApplicationError('DISCOVERY_QUERY_REQUIRED', 400, 'A discovery query is required.', { query: 'أدخل عبارة بحث.' });
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 30) throw new ApplicationError('DISCOVERY_PAGINATION_INVALID', 400, 'Invalid discovery pagination.', { pagination: 'صفحة البحث غير صالحة.' });
    const controller = new AbortController();
    const signal = req.reliability?.signal || controller.signal;
    const response = await this.service.search({ query, page, limit }, signal);
    res.json(response);
  };
}
