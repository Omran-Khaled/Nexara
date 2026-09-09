import { NextFunction, Request, Response } from 'express';
import { ApplicationError } from '../errors/ApplicationErrors';

export interface SecurityOptions {
  nodeEnv: string;
  corsOrigins?: string[];
  rateLimitWindowMs?: number;
  rateLimitMax?: number;
  sensitiveRateLimitMax?: number;
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const MAX_RATE_BUCKETS = 10_000;

function isApiRequest(req: Request): boolean { return req.path === '/api' || req.path.startsWith('/api/'); }
function isSensitiveRoute(req: Request): boolean {
  return /^\/api\/(?:admin\/|books\/[^/]+\/editions\/[^/]+\/files(?:\/|$)|discovery\/gutenberg\/[^/]+\/download$|ingestions(?:\/|$))/.test(req.path);
}
function canonicalOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch { return null; }
}
function pruneBuckets(buckets: Map<string, { count: number; resetAt: number }>, now: number): void {
  if (buckets.size < MAX_RATE_BUCKETS) return;
  for (const [key, value] of buckets) {
    if (value.resetAt <= now || buckets.size >= MAX_RATE_BUCKETS) buckets.delete(key);
    if (buckets.size < MAX_RATE_BUCKETS) break;
  }
}

export function securityHeaders(options: SecurityOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('x-frame-options', 'DENY');
    res.setHeader('referrer-policy', 'no-referrer');
    res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    res.setHeader('cross-origin-opener-policy', 'same-origin');
    res.setHeader('cross-origin-resource-policy', 'same-origin');
    res.setHeader('origin-agent-cluster', '?1');
    res.setHeader('x-dns-prefetch-control', 'off');
    if (isApiRequest(req)) res.setHeader('cache-control', 'no-store, private, max-age=0');
    if (options.nodeEnv === 'production') {
      res.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains');
      res.setHeader('content-security-policy', "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co; media-src 'self' https: data: blob:");
    }
    next();
  };
}

export function strictCors(options: SecurityOptions) {
  const allowed = new Set((options.corsOrigins || []).map(canonicalOrigin).filter((origin): origin is string => Boolean(origin)));
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isApiRequest(req)) return next();
    const requestOrigin = req.header('origin');
    if (!requestOrigin) return next();
    const origin = canonicalOrigin(requestOrigin);
    if (!origin || !allowed.has(origin)) return next(new ApplicationError('CORS_ORIGIN_DENIED', 403, 'This origin is not permitted to access the API.'));
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('vary', 'Origin');
    res.setHeader('access-control-allow-methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    res.setHeader('access-control-allow-headers', 'authorization,content-type,x-request-id,x-file-format,x-file-name,x-source-url,x-download-allowed,x-reading-allowed,x-offline-allowed');
    res.setHeader('access-control-max-age', '600');
    if (req.method === 'OPTIONS') return res.status(204).send();
    next();
  };
}

/**
 * Bearer-token authentication is not ambient, but unsafe browser requests must still carry a same-origin
 * Origin header when an Origin is supplied. This blocks cross-site form and scripted mutation attempts.
 */
export function csrfOriginGuard(options: SecurityOptions) {
  const allowed = new Set((options.corsOrigins || []).map(canonicalOrigin).filter((origin): origin is string => Boolean(origin)));
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!isApiRequest(req) || !UNSAFE_METHODS.has(req.method) || options.nodeEnv === 'test') return next();
    const originHeader = req.header('origin');
    const origin = originHeader ? canonicalOrigin(originHeader) : null;
    const host = req.header('host');
    const selfOrigin = host ? `${req.protocol}://${host}` : null;
    const fetchSite = req.header('sec-fetch-site');
    if (fetchSite === 'cross-site' && (!origin || !allowed.has(origin))) {
      return next(new ApplicationError('CSRF_FETCH_METADATA_DENIED', 403, 'Cross-site state-changing requests are not permitted.'));
    }
    if (originHeader && (!origin || (origin !== selfOrigin && !allowed.has(origin)))) {
      return next(new ApplicationError('CSRF_ORIGIN_DENIED', 403, 'The request origin is not permitted for this operation.'));
    }
    next();
  };
}

export function rateLimit(options: SecurityOptions) {
  const windowMs = options.rateLimitWindowMs || 60_000;
  const normalMax = options.rateLimitMax || 120;
  const sensitiveMax = options.sensitiveRateLimitMax || 20;
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isApiRequest(req) || options.nodeEnv === 'test') return next();
    const now = Date.now();
    pruneBuckets(buckets, now);
    const sensitive = isSensitiveRoute(req);
    const max = sensitive ? sensitiveMax : normalMax;
    const routeClass = sensitive ? 'sensitive' : req.path.split('/').slice(1, 3).join('/');
    const key = `${req.ip || 'unknown'}:${routeClass}`;
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    bucket.count += 1;
    buckets.set(key, bucket);
    res.setHeader('ratelimit-limit', String(max));
    res.setHeader('ratelimit-remaining', String(Math.max(0, max - bucket.count)));
    res.setHeader('ratelimit-reset', String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > max) {
      res.setHeader('retry-after', String(Math.ceil((bucket.resetAt - now) / 1000)));
      return next(new ApplicationError('RATE_LIMITED', 429, 'Too many requests. Please try again later.'));
    }
    next();
  };
}
