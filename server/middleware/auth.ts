import { NextFunction, Request, Response } from 'express';
import { AuthenticationError, AuthorizationError } from '../errors/ApplicationErrors';
import { AuthorizationRepository, NexaraRole as AssignedRole, Permission, permissionsForRoles, primaryRole } from '../auth/AuthorizationRepository';

/** EDITOR remains a test-compatibility alias; durable assignments use READER, MODERATOR, and ADMIN. */
export type NexaraRole = AssignedRole | 'EDITOR';
export interface AuthPrincipal {
  id: string;
  email: string | null;
  role: NexaraRole;
  roles?: NexaraRole[];
  permissions?: Permission[];
  /** ISO territory from trusted identity metadata; never accepted from the request body. */
  territory?: string | null;
}

declare global { namespace Express { interface Request { principal?: AuthPrincipal; } } }

export interface AuthOptions {
  supabaseUrl: string | null;
  supabasePublishableKey: string | null;
  /** 'supabase' (default, production) or 'local' (development password accounts in MongoDB). */
  authProvider?: 'supabase' | 'local';
  /** Local session resolver; required when authProvider is 'local', never wired in production. */
  localSessions?: { resolveSession(token: string): Promise<{ id: string; email: string | null } | null> };
  /** Production role authority. Supabase claims and emails are never treated as role assignments. */
  roleResolver?: AuthorizationRepository;
  allowTestIdentity?: boolean;
  /** Allows test fixtures to resolve roles from the supplied role repository, never enabled in server.ts. */
  useTestRoleResolver?: boolean;
  testRole?: NexaraRole;
}

function bearerToken(value: string | undefined): string | null { const match = value ? /^Bearer\s+(.+)$/i.exec(value.trim()) : null; return match?.[1] || null; }
/** Shared bearer extraction for controllers that need the raw local session token. */
export function bearerTokenOf(req: Request): string | null { return bearerToken(req.header('authorization')); }
function isTestRole(value: string | undefined): value is NexaraRole { return value === 'READER' || value === 'MODERATOR' || value === 'EDITOR' || value === 'ADMIN'; }
function normalizedRoles(roles: NexaraRole[]): AssignedRole[] { return roles.map((role) => role === 'EDITOR' ? 'MODERATOR' : role); }
function makePrincipal(id: string, email: string | null, roles: NexaraRole[], territory: string | null): AuthPrincipal {
  const durable = normalizedRoles(roles.length ? roles : ['READER']);
  return { id, email, role: primaryRole(durable), roles: Array.from(new Set(durable)), permissions: permissionsForRoles(durable), territory };
}

export function createAuthMiddleware(options: AuthOptions) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const token = bearerToken(req.header('authorization'));
    if (!token) {
      if (!options.allowTestIdentity) { next(); return; }
      const id = req.header('x-nexara-test-user');
      if (!id) { next(new AuthenticationError('A test principal header is required when test identity support is enabled.')); return; }
      try {
        const resolved = options.useTestRoleResolver && options.roleResolver ? await options.roleResolver.rolesForUser(id) : null;
        const headerRole = req.header('x-nexara-test-role');
        const roles: NexaraRole[] = resolved || (isTestRole(headerRole) ? [headerRole] : [options.testRole || 'READER']);
        const territory = req.header('x-nexara-test-territory')?.trim().toUpperCase() || null;
        req.principal = makePrincipal(id, null, roles, territory);
        next();
      } catch { next(new AuthenticationError('The authorization store is unavailable.')); }
      return;
    }
    if (options.authProvider === 'local') {
      // Local development sessions are opaque tokens resolved against MongoDB.
      // Roles still resolve through the same AuthorizationRepository below.
      const resolver = options.localSessions;
      try {
        const session = resolver ? await resolver.resolveSession(token) : null;
        if (!session) { next(new AuthenticationError('The local session is invalid or has expired.')); return; }
        const roles: NexaraRole[] = options.roleResolver ? await options.roleResolver.rolesForUser(session.id) : ['READER'];
        req.principal = makePrincipal(session.id, session.email, roles, null);
        next();
      } catch { next(new AuthenticationError('The authentication or authorization service is unavailable.')); }
      return;
    }
    if (!options.supabaseUrl || !options.supabasePublishableKey) { next(new AuthenticationError('Authentication is not configured on this server.')); return; }
    try {
      const response = await fetch(`${options.supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, { headers: { apikey: options.supabasePublishableKey, authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5_000) });
      if (!response.ok) { next(new AuthenticationError()); return; }
      const user: unknown = await response.json();
      if (!user || typeof user !== 'object' || typeof (user as Record<string, unknown>).id !== 'string') { next(new AuthenticationError()); return; }
      const record = user as Record<string, unknown>;
      const appMeta = record.app_metadata && typeof record.app_metadata === 'object' ? record.app_metadata as Record<string, unknown> : {};
      const territory = typeof appMeta.territory === 'string' ? appMeta.territory.trim().toUpperCase() : null;
      const roles: NexaraRole[] = options.roleResolver ? await options.roleResolver.rolesForUser(record.id as string) : ['READER'];
      req.principal = makePrincipal(record.id as string, typeof record.email === 'string' ? record.email : null, roles, territory);
      next();
    } catch { next(new AuthenticationError('The authentication or authorization service is unavailable.')); }
  };
}

export function requirePrincipal(req: Request): AuthPrincipal { if (!req.principal) throw new AuthenticationError(); return req.principal; }
export function requireRole(req: Request, role: AssignedRole): AuthPrincipal { const principal = requirePrincipal(req); if (!normalizedRoles(principal.roles || [principal.role]).includes(role)) throw new AuthorizationError(); return principal; }
export function requirePermission(req: Request, permission: Permission): AuthPrincipal { const principal = requirePrincipal(req); const permissions = principal.permissions || permissionsForRoles(normalizedRoles(principal.roles || [principal.role])); if (!permissions.includes(permission)) throw new AuthorizationError(); return principal; }
export function requireAdmin(req: Request): AuthPrincipal { return requireRole(req, 'ADMIN'); }
