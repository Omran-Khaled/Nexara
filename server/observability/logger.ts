export type ObservabilityLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ObservabilityEvent {
  timestamp: string;
  level: ObservabilityLevel;
  event: string;
  requestId?: string;
  userId?: string;
  route?: string;
  method?: string;
  latencyMs?: number;
  statusCode?: number;
  provider?: string;
  errorCode?: string;
  errorType?: string;
  dependency?: string;
  outcome?: string;
  [field: string]: unknown;
}

function serializable(value: unknown): unknown {
  if (value === undefined || value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(serializable);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !/(authorization|cookie|token|secret|password|body|stack)/i.test(key))
      .map(([key, entry]) => [key, serializable(entry)]));
  }
  return String(value);
}

/** Emits a single JSON object per event so stdout can be indexed by standard log collectors. */
export function logEvent(level: ObservabilityLevel, event: string, fields: Omit<ObservabilityEvent, 'timestamp' | 'level' | 'event'> = {}): void {
  const entry: ObservabilityEvent = { timestamp: new Date().toISOString(), level, event, ...serializable(fields) as Record<string, unknown> };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line); else if (level === 'warn') console.warn(line); else console.log(line);
}

export function routeLabel(req: { baseUrl?: string; route?: { path?: string | string[] }; path?: string; originalUrl?: string }): string {
  const routePath = Array.isArray(req.route?.path) ? req.route?.path.join('|') : req.route?.path;
  if (routePath && req.baseUrl) return `${req.baseUrl}${routePath}`;
  return req.originalUrl?.split('?')[0] || req.path || routePath || '/';
}

export function providerFromDetails(details: unknown): string | undefined {
  if (!details || typeof details !== 'object') return undefined;
  const provider = (details as Record<string, unknown>).provider;
  return typeof provider === 'string' && provider.length <= 160 ? provider : undefined;
}
