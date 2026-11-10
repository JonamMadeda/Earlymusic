import { db } from "./neon";

/**
 * Sessions live in Neon Auth (neon_auth.session) and are resolved by
 * looking the session token up in that table. The browser still holds the
 * app's own cookie, whose value is Neon Auth's signed session value
 * ("<token>.<hmac>"), so the session can be forwarded to Neon Auth when a
 * Neon Auth endpoint has to see it.
 */
export const SESSION_COOKIE = "lumbo_session";

// Neon Auth issues 7-day sessions.
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
// Mirror Better Auth's updateAge: extend the session once it has been idle
// for a day, so active users are never logged out on a timer.
const SESSION_RENEW_AFTER_MS = 24 * 60 * 60 * 1000;

export const getSessionValue = (request) => {
  const value = request.cookies?.get?.(SESSION_COOKIE)?.value;
  return typeof value === "string" && value.length > 0 ? value : null;
};

export const getSessionToken = (request) => {
  const value = getSessionValue(request);
  if (!value) return null;
  const token = value.split(".")[0];
  return token || null;
};

const toIso = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const getUserFromRequest = async (request) => {
  const token = getSessionToken(request);
  if (!token) return null;

  const { rows } = await db.query(
    `SELECT s.id AS session_id,
            s.token,
            s."expiresAt" AS expires_at,
            s."createdAt" AS session_created_at,
            s."updatedAt" AS session_updated_at,
            s."ipAddress" AS ip,
            s."userAgent" AS user_agent,
            u.id,
            u.email,
            u.name,
            u.role,
            u."createdAt" AS created_at,
            u.tos_accepted_at,
            u.privacy_accepted_at,
            u.terms_version,
            u.privacy_version,
            u.age_attested_at
     FROM neon_auth.session s
     JOIN neon_auth.user u ON u.id = s."userId"
     WHERE s.token = $1 AND s."expiresAt" > now()`,
    [token]
  );

  const row = rows?.[0];
  if (!row) return null;

  let expiresAt = toIso(row.expires_at);

  // Sliding renewal. Best-effort: a failed renewal must not fail the
  // request, it only means the session expires on its original schedule.
  const updatedAt = row.session_updated_at
    ? new Date(row.session_updated_at).getTime()
    : 0;
  if (updatedAt && Date.now() - updatedAt > SESSION_RENEW_AFTER_MS) {
    try {
      await db.query(
        `UPDATE neon_auth.session
         SET "expiresAt" = now() + make_interval(secs => $2::double precision),
             "updatedAt" = now()
         WHERE id = $1`,
        [row.session_id, SESSION_TTL_SECONDS]
      );
      expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
    } catch (error) {
      console.error("Unable to extend session:", error);
    }
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name || null,
    role: row.role || null,
    created_at: toIso(row.created_at),
    tos_accepted_at: toIso(row.tos_accepted_at),
    privacy_accepted_at: toIso(row.privacy_accepted_at),
    terms_version: row.terms_version || null,
    privacy_version: row.privacy_version || null,
    age_attested_at: toIso(row.age_attested_at),
    session_id: row.session_id,
    token: row.token,
    expires_at: expiresAt,
    ip: row.ip || null,
    user_agent: row.user_agent || null,
  };
};

export const getAdminFromRequest = async (request) => {
  const user = await getUserFromRequest(request);
  if (!user) return null;
  if (user.role !== "admin") return null;
  return { user, accessToken: getSessionValue(request) };
};

export const setSessionCookie = (response, sessionValue, expiresAt) => {
  response.cookies.set(SESSION_COOKIE, sessionValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
    ...(expiresAt ? { expires: new Date(expiresAt) } : {}),
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
