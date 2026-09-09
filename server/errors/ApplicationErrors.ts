export class ApplicationError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}

export class AuthenticationError extends ApplicationError {
  constructor(message = 'Authentication is required for this operation.') {
    super('UNAUTHENTICATED', 401, message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends ApplicationError {
  constructor(message = 'You do not have permission to perform this operation.') {
    super('FORBIDDEN', 403, message);
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends ApplicationError {
  constructor(details: Record<string, string> | string) {
    super('VALIDATION_ERROR', 400, 'Request validation failed.', details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ApplicationError {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', 404, `${resource} '${id}' was not found.`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ApplicationError {
  constructor(message: string, details?: unknown) {
    super('CONFLICT', 409, message, details);
    this.name = 'ConflictError';
  }
}

export class ExternalProviderError extends ApplicationError {
  constructor(message = 'External provider request failed.', details?: unknown) {
    super('EXTERNAL_PROVIDER_ERROR', 502, message, details);
    this.name = 'ExternalProviderError';
  }
}

export class ProviderError extends ApplicationError {
  constructor(provider: string, stage: string, message = 'An external provider could not complete the request.', statusCode = 502, details?: unknown) {
    super('PROVIDER_ERROR', statusCode, message, { provider, stage, ...(details && typeof details === 'object' ? details as Record<string, unknown> : { details }) });
    this.name = 'ProviderError';
  }
}

export class DatabaseError extends ApplicationError {
  constructor(message = 'Database operation failed.', details?: unknown) {
    super('DATABASE_ERROR', 503, message, details);
    this.name = 'DatabaseError';
  }
}
