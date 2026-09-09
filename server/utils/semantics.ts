export function nowIso(): string {
  return new Date().toISOString();
}

export function isStrictIsoUtc(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
}

export function requireStrictIsoUtc(value: unknown, field: string): string {
  if (!isStrictIsoUtc(value)) throw new Error(`${field} must be a strict ISO-8601 UTC timestamp.`);
  return value;
}

export function normalizeKey(value: string): string {
  return value.trim().normalize('NFKC').toLocaleLowerCase();
}
