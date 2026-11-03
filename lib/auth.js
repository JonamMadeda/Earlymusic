import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "./neon";
import { getClientIp } from "./requestIp";

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Fail closed in production: without a real secret anyone could forge
    // tokens. Development keeps a throwaway default for convenience.
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be set in production.");
    }
    return new TextEncoder().encode("luumbo-dev-secret-change-in-production");
  }
  if (process.env.NODE_ENV === "production" && secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
};

const ALG = "HS256";
const ISSUER = "luumbo";
const AUDIENCE = "luumbo-web";

// Sessions are long-lived so users stay signed in until they explicitly
// log out. The token still carries an exp (30 days) and is renewed on
// activity via /api/auth/me; every request is checked against a live
// user_sessions row so logout can revoke a single device immediately.
export const SESSION_COOKIE = "lumbo_session";
export const SESSION_TTL_DAYS = 30;
export const SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60;
export const RENEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const BCRYPT_ROUNDS = 10;

export const hashPassword = (password) => bcrypt.hash(password, BCRYPT_ROUNDS);
export const verifyPassword = (password, hash) => bcrypt.compare(password, hash);

export const signToken = (payload) =>
  new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_DAYS}d`)
    .sign(getJwtSecret());

export const verifyToken = async (token) => {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: [ALG],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return payload;
  } catch {
    return null;
  }
};

// One-time bridge for tokens issued before issuer/audience/session ids
// existed. Only /api/auth/session may use this.
export const verifyLegacyToken = async (token) => {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: [ALG],
    });
    return payload;
  } catch {
    return null;
  }
};

export const getTokenFromRequest = (request) => {
  const cookie = request.cookies?.get?.(SESSION_COOKIE)?.value;
  if (cookie) return cookie;
  const authHeader = request.headers.get("authorization");
  const match = authHeader?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
};

export const getTokenVersion = async (userId) => {
  const { rows } = await db.query(
    "SELECT token_version FROM public.users WHERE id = $1",
    [userId]
  );
  return rows?.[0]?.token_version ?? 1;
};

// Invalidate every previously issued token for a user ("sign out
// everywhere", password changes).
export const bumpTokenVersion = async (userId) => {
  await db.query(
    "UPDATE public.users SET token_version = token_version + 1 WHERE id = $1",
    [userId]
  );
  return true;
};

export const createSession = async (userId, request) => {
  const { rows } = await db.query(
    `INSERT INTO public.user_sessions (user_id, expires_at, user_agent, ip)
     VALUES ($1, now() + make_interval(days => $2::int), $3, $4)
     RETURNING id`,
    [
      userId,
      SESSION_TTL_DAYS,
      request.headers.get("user-agent")?.slice(0, 512) || null,
      getClientIp(request).slice(0, 64),
    ]
  );
  return rows?.[0]?.id || null;
};

export const signSessionToken = ({ user, sessionId }) =>
  signToken({
    sub: user.id,
    email: user.email,
    tv: user.token_version,
    sid: sessionId,
  });

export const revokeSession = async (sessionId, userId) => {
  await db.query(
    `UPDATE public.user_sessions
     SET revoked_at = now()
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [sessionId, userId]
  );
};

export const revokeAllSessions = async (userId) => {
  await db.query(
    `UPDATE public.user_sessions
     SET revoked_at = now()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
};

export const extendSession = async (sessionId) => {
  const { rows } = await db.query(
    `UPDATE public.user_sessions
     SET expires_at = now() + make_interval(days => $1::int), last_seen_at = now()
     WHERE id = $2 AND revoked_at IS NULL
     RETURNING expires_at`,
    [SESSION_TTL_DAYS, sessionId]
  );
  return rows?.[0]?.expires_at || null;
};

export const setSessionCookie = (response, token) => {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
};

export const clearSessionCookie = (response) => {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
};

export const getUserFromRequest = async (request) => {
  const token = getTokenFromRequest(request);
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload?.sub) return null;
  // Tokens without a session id (pre-hardening) are handled only by the
  // one-time migration endpoint; every other route requires a live session.
  if (typeof payload.sid !== "string" || typeof payload.tv !== "number") {
    return null;
  }

  const { rows } = await db.query(
    `SELECT u.id, u.email, u.created_at, u.token_version,
            s.id AS session_id, s.expires_at, s.last_seen_at
     FROM public.users u
     JOIN public.user_sessions s ON s.user_id = u.id
     WHERE u.id = $1
       AND s.id = $2
       AND s.revoked_at IS NULL
       AND s.expires_at > now()`,
    [payload.sub, payload.sid]
  );
  const user = rows?.[0] || null;
  if (!user) return null;
  if (user.token_version !== payload.tv) return null;

  // Throttled activity ping; never block the request on it.
  if (Date.now() - new Date(user.last_seen_at).getTime() > 5 * 60 * 1000) {
    void db
      .query(
        "UPDATE public.user_sessions SET last_seen_at = now() WHERE id = $1 AND revoked_at IS NULL",
        [user.session_id]
      )
      .catch(() => {});
  }

  return user;
};

// Legacy bearer token -> user, used only by POST /api/auth/session so
// existing signed-in users can be upgraded to a cookie session once.
export const getLegacyUserFromRequest = async (request) => {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  const payload = await verifyLegacyToken(token);
  if (!payload?.sub || payload.sid) return null;

  const { rows } = await db.query(
    "SELECT id, email, created_at, token_version FROM public.users WHERE id = $1",
    [payload.sub]
  );
  const user = rows?.[0] || null;
  if (!user) return null;
  if (payload.tv !== undefined && payload.tv !== user.token_version) {
    return null;
  }
  return user;
};

export const getAdminFromRequest = async (request) => {
  const user = await getUserFromRequest(request);
  if (!user) return null;

  const result = await db.query(
    "SELECT role FROM public.user_roles WHERE user_id = $1 AND role = 'admin'",
    [user.id]
  );
  if (!result.rows?.length) return null;

  return { user, accessToken: getTokenFromRequest(request) };
};
