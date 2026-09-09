import { Request, Response } from 'express';
import { LocalAuthenticationService } from '../auth/LocalAuthenticationService';
import { AuthenticationError, ValidationError } from '../errors/ApplicationErrors';
import { bearerTokenOf, requirePrincipal } from '../middleware/auth';

function sessionView(user: { id: string; email: string; displayName: string; displayNameAr: string }) {
  return { id: user.id, email: user.email, name: user.displayName, nameAr: user.displayNameAr };
}

/**
 * Local development authentication endpoints (AUTH_PROVIDER=local only).
 * createRuntimeApp registers these routes exclusively when the server runs the
 * local provider, so production builds never expose them.
 */
export class LocalAuthController {
  constructor(private readonly localAuth: LocalAuthenticationService) {}

  register = async (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const account = await this.localAuth.register({
      email: body.email,
      password: body.password,
      displayName: body.displayName,
      displayNameAr: body.displayNameAr,
    });
    res.status(201).json({ data: { user: sessionView(account), token: account.token, expiresAt: account.expiresAt.toISOString() } });
  };

  login = async (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const account = await this.localAuth.login({ email: body.email, password: body.password });
    res.status(200).json({ data: { user: sessionView(account), token: account.token, expiresAt: account.expiresAt.toISOString() } });
  };

  session = async (req: Request, res: Response) => {
    const user = await this.localAuth.resolveSession(bearerTokenOf(req));
    if (!user) throw new AuthenticationError('The local session is invalid or has expired.');
    res.status(200).json({ data: { user: sessionView(user) } });
  };

  logout = async (req: Request, res: Response) => {
    await this.localAuth.logout(bearerTokenOf(req));
    res.status(204).send();
  };

  updateProfile = async (req: Request, res: Response) => {
    const principal = requirePrincipal(req);
    const body = (req.body || {}) as Record<string, unknown>;
    if (body.displayName === undefined && body.displayNameAr === undefined) {
      throw new ValidationError({ displayName: 'at least one of displayName or displayNameAr is required.' });
    }
    const user = await this.localAuth.updateProfile(principal.id, body);
    res.status(200).json({ data: { user: sessionView(user) } });
  };

  updatePassword = async (req: Request, res: Response) => {
    const principal = requirePrincipal(req);
    const body = (req.body || {}) as Record<string, unknown>;
    if (body.newPassword === undefined) throw new ValidationError({ newPassword: 'is required.' });
    await this.localAuth.updatePassword(principal.id, body.newPassword);
    res.status(204).send();
  };
}