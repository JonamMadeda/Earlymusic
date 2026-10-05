import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "./neon";

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
  return new TextEncoder().encode(secret);
};
const ALG = "HS256";
const TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const BCRYPT_ROUNDS = 10;

export const hashPassword = (password) => bcrypt.hash(password, BCRYPT_ROUNDS);
export const verifyPassword = (password, hash) => bcrypt.compare(password, hash);

export const signToken = (payload) =>
  new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_MAX_AGE}s`)
    .sign(getJwtSecret());

export const verifyToken = async (token) => {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), { algorithms: [ALG] });
    return payload;
  } catch {
    return null;
  }
};

const isMissingColumn = (error, column) =>
  new RegExp(column, "i").test(error?.message || "");

// Current token version for a user (1 when the column doesn't exist yet).
// Stored in new tokens as `tv`; a mismatch means "signed out everywhere".
export const getTokenVersion = async (userId) => {
  try {
    const { rows } = await db.query(
      "SELECT token_version FROM public.users WHERE id = $1",
      [userId]
    );
    return rows?.[0]?.token_version ?? 1;
  } catch (error) {
    if (!isMissingColumn(error, "token_version")) throw error;
    return 1;
  }
};

// Invalidate every previously issued token for a user. Returns false when
// the column doesn't exist yet (password still changed — revocation just
// can't apply until lib/migration-token-version.sql has run).
export const bumpTokenVersion = async (userId) => {
  try {
    await db.query(
      "UPDATE public.users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = $1",
      [userId]
    );
    return true;
  } catch (error) {
    if (!isMissingColumn(error, "token_version")) throw error;
    return false;
  }
};

export const getUserFromRequest = async (request) => {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload?.sub) return null;

  // token_version lets a password change revoke all older tokens (see
  // lib/migration-token-version.sql). Databases predating that column fall
  // back to the legacy lookup, treating the token as valid.
  let rows;
  try {
    const result = await db.query(
      "SELECT id, email, created_at, token_version FROM public.users WHERE id = $1",
      [payload.sub]
    );
    rows = result.rows;
  } catch (error) {
    if (!isMissingColumn(error, "token_version")) throw error;
    const result = await db.query(
      "SELECT id, email, created_at FROM public.users WHERE id = $1",
      [payload.sub]
    );
    rows = result.rows;
  }
  const user = rows?.[0] || null;
  if (!user) return null;
  if (
    payload.tv !== undefined &&
    user.token_version !== undefined &&
    user.token_version !== null &&
    payload.tv !== user.token_version
  ) {
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

  return { user, accessToken: request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") };
};
