import type { NextRequest } from "next/server";

const DEFAULT_AUTH_URL =
  "https://ep-lively-mud-b58sauy3.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth";

export const NEON_AUTH_URL = (
  process.env.NEON_AUTH_URL || DEFAULT_AUTH_URL
).replace(/\/+$/, "");

export const NEON_AUTH_JWKS_URL =
  process.env.NEON_AUTH_JWKS_URL || `${NEON_AUTH_URL}/.well-known/jwks.json`;

// Neon Auth (managed Better Auth) stores its session cookie under this
// name. The app keeps its own cookie, so this value is only used when
// forwarding a session to Neon Auth.
export const NEON_AUTH_SESSION_COOKIE = "__Secure-neon-auth.session_token";

const REQUEST_TIMEOUT_MS = 10_000;

export type NeonAuthUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: string;
  updatedAt: string;
  role?: string | null;
  banned?: boolean | null;
};

export type NeonAuthSession = {
  id: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  userId: string;
};

/**
 * A flat result shape on purpose: this project compiles with
 * strictNullChecks off, and TypeScript only narrows discriminated unions
 * when it is on. Every field is therefore always present.
 */
export type NeonAuthResult<T> = {
  ok: boolean;
  data: T | null;
  sessionValue: string | null;
  status: number;
  code: string;
  message: string;
};

export const NEON_AUTH_ERRORS = {
  invalidCredentials: "INVALID_EMAIL_OR_PASSWORD",
  emailExists: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
} as const;

/**
 * The Origin Neon Auth sees. Better Auth rejects requests without one and
 * only trusts origins listed in the Neon console (plus localhost in
 * development), so this must match the site the user is actually on.
 */
export const resolveAuthOrigin = (request?: NextRequest | null): string => {
  if (process.env.NEON_AUTH_ORIGIN) return process.env.NEON_AUTH_ORIGIN;

  if (request) {
    const host =
      request.headers.get("x-forwarded-host") || request.headers.get("host");
    if (host) {
      const forwardedProto = request.headers.get("x-forwarded-proto");
      const protocol =
        forwardedProto ||
        (request.nextUrl?.protocol || "http:").replace(":", "");
      return `${protocol}://${host}`;
    }
  }

  return "http://localhost:3000";
};

/**
 * Neon Auth signs its session cookie as "<token>.<hmac>". Only the token
 * half is stored in neon_auth.session; the signature proves the cookie
 * came from Neon Auth. The app keeps the whole signed value so it can be
 * forwarded verbatim to Neon Auth's own session endpoints.
 */
export const readSessionValue = (
  setCookie: string[] | null | undefined
): string | null => {
  if (!setCookie) return null;
  for (const header of setCookie) {
    const match = header.match(
      new RegExp(`^\\s*${NEON_AUTH_SESSION_COOKIE}=([^;]*)`)
    );
    if (match) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return match[1];
      }
    }
  }
  return null;
};

const neonAuthFetch = async <T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    session?: string | null;
    origin?: string | null;
  } = {}
): Promise<NeonAuthResult<T>> => {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (options.origin) headers.origin = options.origin;
  if (options.session) {
    headers.cookie = `${NEON_AUTH_SESSION_COOKIE}=${options.session}`;
  }

  let response: Response;
  try {
    response = await fetch(`${NEON_AUTH_URL}/${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("Neon Auth request failed:", error);
    return {
      ok: false,
      data: null,
      sessionValue: null,
      status: 502,
      code: "NEON_AUTH_UNAVAILABLE",
      message: "The authentication service is unavailable.",
    };
  }

  const setCookie = response.headers.getSetCookie?.() ?? null;
  const sessionValue = readSessionValue(setCookie);

  const text = await response.text();
  let payload: any = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    return {
      ok: false,
      data: null,
      sessionValue,
      status: response.status,
      code: payload?.code || "NEON_AUTH_ERROR",
      message:
        payload?.message || "The authentication service rejected the request.",
    };
  }

  return {
    ok: true,
    data: (payload ?? {}) as T,
    sessionValue,
    status: response.status,
    code: "",
    message: "",
  };
};

export const signUpWithNeonAuth = async ({
  email,
  password,
  name,
  origin,
}: {
  email: string;
  password: string;
  name: string;
  origin: string;
}): Promise<NeonAuthResult<{ user: NeonAuthUser; token: string }>> =>
  neonAuthFetch("sign-up/email", {
    method: "POST",
    origin,
    body: { email, password, name },
  });

export const signInWithNeonAuth = async ({
  email,
  password,
  origin,
}: {
  email: string;
  password: string;
  origin: string;
}): Promise<NeonAuthResult<{ user: NeonAuthUser; token: string }>> =>
  neonAuthFetch("sign-in/email", {
    method: "POST",
    origin,
    body: { email, password },
  });

export const changePasswordWithNeonAuth = async ({
  session,
  currentPassword,
  newPassword,
  revokeOtherSessions = true,
  origin,
}: {
  session: string;
  currentPassword: string;
  newPassword: string;
  revokeOtherSessions?: boolean;
  origin: string;
}): Promise<NeonAuthResult<{ status: boolean }>> =>
  neonAuthFetch("change-password", {
    method: "POST",
    origin,
    session,
    body: { currentPassword, newPassword, revokeOtherSessions },
  });

export const signOutWithNeonAuth = async ({
  session,
  origin,
}: {
  session: string;
  origin: string;
}): Promise<NeonAuthResult<{ success: boolean }>> =>
  neonAuthFetch("sign-out", { method: "POST", origin, session });

/**
 * Asks Neon Auth to email a password-reset link. The managed instance
 * exposes this as `request-password-reset`, not the `forget-password` path
 * in Better Auth's docs — the latter answers 404 here. Neon owns the token
 * (a `reset-password:<token>` row in neon_auth.verification), its hour-long
 * expiry and the delivery; the link it sends is `${baseURL}/reset-password?token=…`.
 * It works for accounts that have no credential row yet, which is every
 * account migrated from the legacy bcrypt hashes.
 */
export const requestPasswordResetWithNeonAuth = async ({
  email,
  redirectTo,
  origin,
}: {
  email: string;
  redirectTo: string;
  origin: string;
}): Promise<NeonAuthResult<{ status?: boolean; message?: string }>> =>
  neonAuthFetch("request-password-reset", {
    method: "POST",
    origin,
    body: { email, redirectTo },
  });

/**
 * Completes a reset. Better Auth names the field newPassword, hashes it into
 * neon_auth.account, and revokes the account's other sessions itself.
 */
export const resetPasswordWithNeonAuth = async ({
  token,
  newPassword,
  origin,
}: {
  token: string;
  newPassword: string;
  origin: string;
}): Promise<NeonAuthResult<{ status?: boolean }>> =>
  neonAuthFetch("reset-password", {
    method: "POST",
    origin,
    body: { token, newPassword },
  });

export const listSessionsWithNeonAuth = async ({
  session,
  origin,
}: {
  session: string;
  origin: string;
}): Promise<NeonAuthResult<NeonAuthSession[]>> =>
  neonAuthFetch("list-sessions", { origin, session });

export const adminSetUserPasswordWithNeonAuth = async ({
  session,
  userId,
  newPassword,
  origin,
}: {
  session: string;
  userId: string;
  newPassword: string;
  origin: string;
}): Promise<NeonAuthResult<{ status: boolean }>> =>
  neonAuthFetch("admin/set-user-password", {
    method: "POST",
    origin,
    session,
    body: { userId, newPassword },
  });
