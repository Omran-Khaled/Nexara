import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { logEvent, routeLabel } from '../observability/logger';

export interface ServerRequestLogEntry {
  requestId: string;
  userId?: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
  outcome: 'success' | 'client_aborted' | 'timed_out' | 'error';
}

const logs: ServerRequestLogEntry[] = [];
const MAX_LOGS = 500;
function append(entry: ServerRequestLogEntry) {
  logs.push(entry);
  if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS);
}
export function recentServerRequestLog(): readonly ServerRequestLogEntry[] { return logs.slice(); }

export interface RequestReliabilityContext {
  requestId: string;
  signal: AbortSignal;
  deadlineAt: number;
}

declare global {
  namespace Express { interface Request { reliability?: RequestReliabilityContext; } }
}

function requestId(value: string | undefined): string {
  return value && /^[A-Za-z0-9._-]{8,120}$/.test(value) ? value : randomUUID();
}

/** Bounded request lifetime with observability; downstream providers receive req.reliability.signal. */
export function requestReliability(timeoutMs = 20_000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startedAt = Date.now();
    const id = requestId(req.header('x-request-id'));
    const controller = new AbortController();
    let timedOut = false;
    let clientAborted = false;
    req.reliability = { requestId: id, signal: controller.signal, deadlineAt: startedAt + timeoutMs };
    res.setHeader('x-request-id', id);
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      if (!res.headersSent) res.status(504).json({ error: { code: 'REQUEST_TIMEOUT', message: 'The API request exceeded its server time budget.', requestId: id } });
    }, timeoutMs);
    req.on('aborted', () => { clientAborted = true; controller.abort(); });
    res.on('finish', () => {
      clearTimeout(timer);
      const durationMs = Date.now() - startedAt;
      const outcome: ServerRequestLogEntry['outcome'] = timedOut ? 'timed_out' : clientAborted ? 'client_aborted' : res.statusCode >= 500 ? 'error' : 'success';
      const entry = { requestId: id, ...(req.principal?.id ? { userId: req.principal.id } : {}), method: req.method, route: routeLabel(req), status: res.statusCode, durationMs, outcome };
      append(entry);
      logEvent(res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info', 'http_request_completed', { requestId: id, ...(req.principal?.id ? { userId: req.principal.id } : {}), method: req.method, route: entry.route, latencyMs: durationMs, statusCode: res.statusCode, outcome });
    });
    res.on('close', () => { if (!res.writableEnded) { clientAborted = true; controller.abort(); } });
    next();
  };
}
