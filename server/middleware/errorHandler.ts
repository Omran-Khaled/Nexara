import { ErrorRequestHandler } from 'express';
import { ApplicationError, AuthenticationError, AuthorizationError, DatabaseError, ExternalProviderError, ProviderError, ValidationError } from '../errors/ApplicationErrors';
import { logEvent, providerFromDetails, routeLabel } from '../observability/logger';

function errorContext(req: Parameters<ErrorRequestHandler>[1], error: ApplicationError) {
  return {
    ...(req.reliability?.requestId ? { requestId: req.reliability.requestId } : {}),
    ...(req.principal?.id ? { userId: req.principal.id } : {}),
    method: req.method,
    route: routeLabel(req),
    statusCode: error.statusCode,
    errorCode: error.code,
    errorType: error.name,
    ...(providerFromDetails(error.details) ? { provider: providerFromDetails(error.details) } : {}),
  };
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const requestId = req.reliability?.requestId;
  if (error instanceof ApplicationError) {
    const context = errorContext(req, error);
    if (error instanceof DatabaseError) logEvent('error', 'database_error', context);
    else if (error instanceof AuthenticationError) logEvent('warn', 'authentication_failed', context);
    else if (error instanceof AuthorizationError) logEvent('warn', 'authorization_denied', context);
    else if (error instanceof ExternalProviderError || error instanceof ProviderError) logEvent('error', 'provider_error', context);
    else if (error.statusCode >= 500) logEvent('error', 'api_application_error', context);
    else if (error.statusCode >= 400) logEvent('warn', 'api_request_rejected', context);
    const details = error instanceof ValidationError ? error.details : undefined;
    res.status(error.statusCode).json({ error: { code: error.code, message: error.message, ...(details === undefined ? {} : { details }), ...(requestId ? { requestId } : {}) } });
    return;
  }
  if ((error as { statusCode?: unknown })?.statusCode === 400 || (error as { status?: unknown })?.status === 400) {
    logEvent('warn', 'api_invalid_request', { ...(requestId ? { requestId } : {}), ...(req.principal?.id ? { userId: req.principal.id } : {}), method: req.method, route: routeLabel(req), statusCode: 400, errorType: error instanceof Error ? error.name : typeof error });
    res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'The request contains an invalid encoded path or payload.', ...(requestId ? { requestId } : {}) } });
    return;
  }
  logEvent('error', 'api_unhandled_error', { ...(requestId ? { requestId } : {}), ...(req.principal?.id ? { userId: req.principal.id } : {}), method: req.method, route: routeLabel(req), statusCode: 500, errorType: error instanceof Error ? error.name : typeof error });
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred.', ...(requestId ? { requestId } : {}) } });
};
