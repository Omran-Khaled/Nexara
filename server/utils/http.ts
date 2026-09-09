import { ValidationError } from '../errors/ApplicationErrors';

export function parseId(value: unknown, field = 'id'): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) {
    throw new ValidationError({ [field]: 'must be a non-empty safe identifier.' });
  }
  return value;
}

export interface PageRequest {
  page: number;
  limit: number;
}

export function parsePage(query: Record<string, unknown>): PageRequest {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isInteger(page) || page < 1) throw new ValidationError({ page: 'must be a positive integer.' });
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ValidationError({ limit: 'must be an integer between 1 and 100.' });
  return { page, limit };
}
