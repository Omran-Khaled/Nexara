import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Collection, Db } from 'mongodb';
import { AuthenticationError, ConflictError, ValidationError } from '../errors/ApplicationErrors';

const scrypt = promisify(scryptCallback) as (password: string | Buffer, salt: string | Buffer, keylen: number, options: { N: number; r: number; p: number }) => Promise<Buffer>;

/** OWASP-accepted minimum scrypt cost (N=2^14, r=8, p=1). */
const SCRYPT_PARAMETERS = { N: 16384, r: 8, p: 1 } as const;
/** Timing-equalizer hash so unknown-account logins perform comparable work. */
const DUMMY_PASSWORD_HASH = 'scrypt$16384$8$1$' + '0'.repeat(32) + '$' + '0'.repeat(128);

export interface LocalUserProfile {
  id: string;
  email: string;
  displayName: string;
  displayNameAr: string;
}

export interface LocalSessionGrant {
  token: string;
  expiresAt: Date;
}

interface LocalUserRecord extends LocalUserProfile {
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

interface LocalSessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
}

function profileOf(record: LocalUserRecord): LocalUserProfile {
  return { id: record.id, email: record.email, displayName: record.displayName, displayNameAr: record.displayNameAr };
}

function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError({ email: 'must be a string.' });
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new ValidationError({ email: 'must be a valid email address.' });
  }
  return email;
}

function normalizePassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < 10 || value.length > 128) {
    throw new ValidationError({ password: 'must contain between 10 and 128 characters.' });
  }
  return value;
}

function normalizeDisplayName(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  return value.trim().slice(0, 80);
}

/**
 * Development authentication authority (AUTH_PROVIDER=local).
 *
 * Stores password accounts in MongoDB with scrypt-hashed credentials and issues
 * opaque bearer session tokens whose SHA-256 hashes are the only persisted form.
 * Roles are NEVER stored here; they continue to resolve through the shared
 * AuthorizationRepository so the authorization model stays identical to the
 * Supabase production path. This service is unreachable in production: env.ts
 * rejects AUTH_PROVIDER=local when NODE_ENV=production and createRuntimeApp
 * registers its routes only in local mode.
 */
export class LocalAuthenticationService {
  private readonly users: Collection<LocalUserRecord>;
  private readonly sessions: Collection<LocalSessionRecord>;

  constructor(db: Db, private readonly sessionTtlHours = 168) {
    this.users = db.collection('local_users');
    this.sessions = db.collection('local_sessions');
  }

  async ensureIndexes(): Promise<void> {
    await this.users.createIndex({ email: 1 }, { unique: true });
    await this.sessions.createIndex({ tokenHash: 1 }, { unique: true });
    await this.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derived = await scrypt(password.normalize('NFKC'), salt, 64, SCRYPT_PARAMETERS);
    return `scrypt$${SCRYPT_PARAMETERS.N}$${SCRYPT_PARAMETERS.r}$${SCRYPT_PARAMETERS.p}$${salt.toString('hex')}$${derived.toString('hex')}`;
  }

  private async verifyPassword(password: string, stored: string): Promise<boolean> {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, n, r, p, saltHex, hashHex] = parts;
    const expected = Buffer.from(hashHex, 'hex');
    const derived = await scrypt(password.normalize('NFKC'), Buffer.from(saltHex, 'hex'), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueSession(userId: string): Promise<LocalSessionGrant> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.sessionTtlHours * 3_600_000);
    const record: LocalSessionRecord = { id: randomUUID(), userId, tokenHash: this.hashToken(token), createdAt: new Date(), expiresAt };
    await this.sessions.insertOne(record);
    return { token, expiresAt };
  }

  async findByEmail(email: string): Promise<LocalUserProfile | null> {
    const record = await this.users.findOne({ email: email.trim().toLowerCase() }, { projection: { passwordHash: 0 } });
    return record ? profileOf(record) : null;
  }

  async register(input: { email: unknown; password: unknown; displayName?: unknown; displayNameAr?: unknown }): Promise<LocalUserProfile & LocalSessionGrant> {
    const email = normalizeEmail(input.email);
    const password = normalizePassword(input.password);
    const existing = await this.users.findOne({ email }, { projection: { _id: 1 } });
    if (existing) throw new ConflictError('An account with this email already exists.');
    const fallbackName = email.split('@')[0].slice(0, 80);
    const record: LocalUserRecord = {
      id: randomUUID(),
      email,
      passwordHash: await this.hashPassword(password),
      displayName: normalizeDisplayName(input.displayName, fallbackName),
      displayNameAr: normalizeDisplayName(input.displayNameAr, normalizeDisplayName(input.displayName, fallbackName)),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    try {
      await this.users.insertOne(record);
    } catch (error) {
      // Duplicate-key race on the unique email index.
      if (typeof error === 'object' && error && (error as { code?: number }).code === 11000) {
        throw new ConflictError('An account with this email already exists.');
      }
      throw error;
    }
    return { ...profileOf(record), ...(await this.issueSession(record.id)) };
  }

  async login(input: { email: unknown; password: unknown }): Promise<LocalUserProfile & LocalSessionGrant> {
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    const password = typeof input.password === 'string' ? input.password : '';
    const record = email ? await this.users.findOne({ email }) : null;
    // Equalize work between known and unknown accounts before failing.
    if (!record) {
      await this.verifyPassword(password || 'timing-equalizer', DUMMY_PASSWORD_HASH);
      throw new AuthenticationError('Invalid email or password.');
    }
    if (!(await this.verifyPassword(password, record.passwordHash))) {
      throw new AuthenticationError('Invalid email or password.');
    }
    return { ...profileOf(record), ...(await this.issueSession(record.id)) };
  }

  async resolveSession(token: string | null | undefined): Promise<LocalUserProfile | null> {
    if (!token || typeof token !== 'string' || token.length > 512) return null;
    const session = await this.sessions.findOne({ tokenHash: this.hashToken(token), expiresAt: { $gt: new Date() } });
    if (!session) return null;
    const record = await this.users.findOne({ id: session.userId }, { projection: { passwordHash: 0 } });
    return record ? profileOf(record) : null;
  }

  async logout(token: string | null | undefined): Promise<void> {
    if (!token) return;
    await this.sessions.deleteOne({ tokenHash: this.hashToken(token) });
  }

  async updateProfile(userId: string, input: { displayName?: unknown; displayNameAr?: unknown }): Promise<LocalUserProfile> {
    const current = await this.users.findOne({ id: userId }, { projection: { passwordHash: 0 } });
    if (!current) throw new AuthenticationError();
    const displayName = normalizeDisplayName(input.displayName, current.displayName);
    const displayNameAr = normalizeDisplayName(input.displayNameAr, current.displayNameAr);
    await this.users.updateOne({ id: userId }, { $set: { displayName, displayNameAr, updatedAt: new Date() } });
    return { ...profileOf(current), displayName, displayNameAr };
  }

  async updatePassword(userId: string, newPassword: unknown): Promise<void> {
    const password = normalizePassword(newPassword);
    const record = await this.users.findOne({ id: userId }, { projection: { passwordHash: 1 } });
    if (!record) throw new AuthenticationError();
    if (await this.verifyPassword(password, record.passwordHash)) {
      throw new ValidationError({ password: 'must differ from the current password.' });
    }
    await this.users.updateOne({ id: userId }, { $set: { passwordHash: await this.hashPassword(password), updatedAt: new Date() } });
  }
}
