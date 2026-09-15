import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "./neon";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "luumbo-dev-secret-change-in-production");
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
    .sign(JWT_SECRET);

export const verifyToken = async (token) => {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, { algorithms: [ALG] });
    return payload;
  } catch {
    return null;
  }
};

export const getUserFromRequest = async (request) => {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload?.sub) return null;

  const result = await db.query(
    "SELECT id, email, created_at FROM public.users WHERE id = $1",
    [payload.sub]
  );
  return result.rows?.[0] || null;
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
