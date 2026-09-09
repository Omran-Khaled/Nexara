import {
  createClient,
  Session,
  SupabaseClient,
  User,
} from "@supabase/supabase-js";

type ViteRuntime = ImportMeta & { env?: Record<string, string | undefined> };
const viteEnv = ((import.meta as ViteRuntime).env || {}) as Record<
  string,
  string | undefined
>;
const url = viteEnv.VITE_SUPABASE_URL;
const publishableKey =
  viteEnv.VITE_SUPABASE_PUBLISHABLE_KEY || viteEnv.VITE_SUPABASE_ANON_KEY;

/**
 * Application-level authentication mode. 'supabase' is the production provider
 * (the server verifies every bearer token against Supabase Auth); 'local' is
 * the development-only provider (AUTH_PROVIDER=local password accounts stored
 * in MongoDB). The rest of the UI only ever consumes AuthenticatedProfile plus
 * server-resolved roles, so provider details stay behind this module.
 */
export type AuthMode = "supabase" | "local" | "unconfigured";
const requestedProvider = (viteEnv.VITE_AUTH_PROVIDER || "")
  .trim()
  .toLowerCase();
export const authMode: AuthMode =
  requestedProvider === "local"
    ? "local"
    : url && publishableKey
      ? "supabase"
      : "unconfigured";
export const authConfigured = authMode !== "unconfigured";
export const supabase: SupabaseClient | null =
  authMode === "supabase" && url && publishableKey
    ? createClient(url, publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export interface AuthenticatedProfile {
  id: string;
  email: string;
  name: string;
  nameAr: string;
}

export function profileFromUser(user: User): AuthenticatedProfile {
  const metadata = user.user_metadata || {};
  const name =
    typeof metadata.display_name === "string" && metadata.display_name.trim()
      ? metadata.display_name.trim().slice(0, 80)
      : (user.email || "Reader").split("@")[0].slice(0, 80);
  const nameAr =
    typeof metadata.display_name_ar === "string" &&
    metadata.display_name_ar.trim()
      ? metadata.display_name_ar.trim().slice(0, 80)
      : name;
  return { id: user.id, email: user.email || "", name, nameAr };
}

// --- Local development provider -------------------------------------------
// supabase-js persists Supabase sessions; the local provider persists its
// equivalent opaque token in localStorage and lets the server resolve it on
// every request. Raw fetch is used deliberately to avoid a circular import
// with src/api/http.ts (which imports accessToken from this module).

const LOCAL_SESSION_KEY = "nexara-local-session";
interface LocalAccountDto {
  id: string;
  email: string;
  displayName: string;
  displayNameAr: string;
}
interface LocalSessionResponse {
  data: { user: LocalAccountDto; token?: string; expiresAt?: string };
}

function storedLocalToken(): string | null {
  try {
    return window.localStorage.getItem(LOCAL_SESSION_KEY);
  } catch {
    return null;
  }
}

function persistLocalToken(token: string): void {
  try {
    window.localStorage.setItem(LOCAL_SESSION_KEY, token);
  } catch {
    /* Private-mode storage failures keep the session memory-only. */
  }
}

function clearLocalToken(): void {
  try {
    window.localStorage.removeItem(LOCAL_SESSION_KEY);
  } catch {
    /* Nothing to clear. */
  }
}

function profileFromLocalAccount(
  account: LocalAccountDto,
): AuthenticatedProfile {
  const fallback = account.email.split("@")[0] || "Reader";
  return {
    id: account.id,
    email: account.email || "",
    name: account.displayName || fallback,
    nameAr: account.displayNameAr || account.displayName || fallback,
  };
}

async function localFetch(
  path: string,
  init: RequestInit,
): Promise<LocalSessionResponse> {
  const response = await fetch(
    path.startsWith("/api") ? path : `/api${path}`,
    init,
  );
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    /* Non-JSON error body falls through to the generic message. */
  }
  if (!response.ok) {
    const errorPayload = payload as { error?: { message?: unknown } } | null;
    const message =
      errorPayload && typeof errorPayload.error?.message === "string"
        ? errorPayload.error.message
        : `Authentication request failed with status ${response.status}.`;
    throw new Error(message);
  }
  return payload as LocalSessionResponse;
}

async function authorizedLocalFetch(
  path: string,
  method: string,
  body?: unknown,
): Promise<LocalSessionResponse | null> {
  const token = storedLocalToken();
  if (!token) return null;
  return localFetch(path, {
    method,
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      authorization: `Bearer ${token}`,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

export interface LocalCredentials {
  email: string;
  password: string;
  displayName?: string;
  displayNameAr?: string;
}

/** Development-only password provider backed by the /api/auth/local endpoints. */
export const localAuth = {
  async register(credentials: LocalCredentials): Promise<AuthenticatedProfile> {
    const response = await localFetch("/api/auth/local/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: credentials.email.trim(),
        password: credentials.password,
        displayName: credentials.displayName?.trim() || undefined,
        displayNameAr: credentials.displayNameAr?.trim() || undefined,
      }),
    });
    if (!response.data.token)
      throw new Error(
        "The local account was created but no session token was issued.",
      );
    persistLocalToken(response.data.token);
    return profileFromLocalAccount(response.data.user);
  },

  async login(credentials: LocalCredentials): Promise<AuthenticatedProfile> {
    const response = await localFetch("/api/auth/local/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: credentials.email.trim(),
        password: credentials.password,
      }),
    });
    if (!response.data.token)
      throw new Error("Sign-in succeeded but no session token was issued.");
    persistLocalToken(response.data.token);
    return profileFromLocalAccount(response.data.user);
  },

  /** Restores a persisted session against the server; returns null when absent or expired. */
  async restore(): Promise<AuthenticatedProfile | null> {
    try {
      const response = await authorizedLocalFetch(
        "/api/auth/local/session",
        "GET",
      );
      if (!response?.data?.user) {
        clearLocalToken();
        return null;
      }
      return profileFromLocalAccount(response.data.user);
    } catch {
      clearLocalToken();
      return null;
    }
  },

  async logout(): Promise<void> {
    try {
      await authorizedLocalFetch("/api/auth/local/logout", "POST");
    } finally {
      // The session ends client-side even if the server call fails.
      clearLocalToken();
    }
  },

  async updateProfile(
    displayName: string,
    displayNameAr: string,
  ): Promise<AuthenticatedProfile> {
    const response = await authorizedLocalFetch(
      "/api/auth/local/profile",
      "PATCH",
      { displayName, displayNameAr },
    );
    if (!response?.data?.user)
      throw new Error("Unable to update the local profile.");
    return profileFromLocalAccount(response.data.user);
  },

  async updatePassword(newPassword: string): Promise<void> {
    const response = await authorizedLocalFetch(
      "/api/auth/local/password",
      "POST",
      { newPassword },
    );
    if (response === null) throw new Error("No active local session.");
  },
};

export async function accessToken(): Promise<string | null> {
  if (authMode === "supabase" && supabase) {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  }
  if (authMode === "local") return storedLocalToken();
  return null;
}

export async function currentSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}
