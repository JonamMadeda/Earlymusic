import bcrypt from "bcryptjs";
import { db } from "./neon";
import { hashPassword, verifyPassword as verifyNeonPassword } from "./neonAuthHash";

/**
 * Credential storage for Neon Auth accounts.
 *
 * Neon Auth keeps password hashes in neon_auth.account with Better Auth's
 * scrypt scheme ("<salt>:<hash>"). Accounts that predate Neon Auth hold a
 * bcrypt hash instead, which cannot be converted without the plaintext, so
 * it is parked in public.legacy_credentials until the owner signs in once.
 * That sign-in verifies the bcrypt hash, writes the scrypt credential, and
 * marks the legacy row upgraded. Afterwards the account is native.
 */

const CREDENTIAL_PROVIDER = "credential";

export const getCredentialAccount = async (userId) => {
  const { rows } = await db.query(
    `SELECT id, password FROM neon_auth.account
     WHERE "userId" = $1 AND "providerId" = $2
     LIMIT 1`,
    [userId, CREDENTIAL_PROVIDER]
  );
  return rows?.[0] || null;
};

/**
 * neon_auth.account has no unique constraint on ("accountId","providerId"),
 * so the row is looked up first instead of relying on ON CONFLICT.
 */
export const writeCredentialAccount = async (userId, password) => {
  const passwordHash = await hashPassword(password);

  const existing = await getCredentialAccount(userId);
  if (existing?.id) {
    await db.query(
      `UPDATE neon_auth.account
       SET password = $1, "updatedAt" = now()
       WHERE id = $2`,
      [passwordHash, existing.id]
    );
    return existing.id;
  }

  const { rows } = await db.query(
    `INSERT INTO neon_auth.account
       (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
     VALUES (gen_random_uuid(), $1::text, $2, $3::uuid, $4, now(), now())
     RETURNING id`,
    [userId, CREDENTIAL_PROVIDER, userId, passwordHash]
  );
  return rows?.[0]?.id || null;
};

export const setCredentialPassword = async (accountId, password) => {
  const passwordHash = await hashPassword(password);
  await db.query(
    `UPDATE neon_auth.account
     SET password = $1, "updatedAt" = now()
     WHERE id = $2`,
    [passwordHash, accountId]
  );
};

export const verifyCredentialPassword = async (password, storedHash) =>
  verifyNeonPassword(password, storedHash);

/**
 * Looks up a parked bcrypt hash that is still authoritative.
 *
 * Once `upgraded_at` is set the account has a real Neon Auth scrypt
 * credential, and that hash is the only thing that may authenticate it.
 * Without this filter a password reset (or any upgrade) would leave the
 * previous password working: sign-in falls back to the legacy branch
 * whenever Neon Auth rejects the new password, and the old bcrypt hash
 * still matches there.
 */
export const findLegacyCredentialByEmail = async (email) => {
  const { rows } = await db.query(
    `SELECT user_id, email, password_hash, upgraded_at, created_at
     FROM public.legacy_credentials
     WHERE lower(email) = $1 AND upgraded_at IS NULL`,
    [String(email || "").toLowerCase()]
  );
  return rows?.[0] || null;
};

export const findLegacyCredentialByUserId = async (userId) => {
  const { rows } = await db.query(
    `SELECT user_id, email, password_hash, upgraded_at, created_at
     FROM public.legacy_credentials
     WHERE user_id = $1 AND upgraded_at IS NULL`,
    [userId]
  );
  return rows?.[0] || null;
};

export const verifyLegacyPassword = async (password, passwordHash) => {
  if (typeof passwordHash !== "string" || !passwordHash) return false;
  try {
    return await bcrypt.compare(password, passwordHash);
  } catch {
    return false;
  }
};

/**
 * A real bcrypt hash so an unknown account costs the same as a wrong
 * password. Without it, response timing reveals which accounts exist.
 */
export const DUMMY_PASSWORD_HASH =
  "$2b$10$Br4BLaLE0Vc4lWKUq1Li2OKYFl6Wrphnq5k1LxdUMAivG31Qbt6KG";

export const burnPasswordCompare = async (password) => {
  try {
    await bcrypt.compare(String(password || ""), DUMMY_PASSWORD_HASH);
  } catch {
    // The comparison already cost the bcrypt work we care about.
  }
};

export const markLegacyUpgraded = async (userId) => {
  await db.query(
    `UPDATE public.legacy_credentials
     SET upgraded_at = now()
     WHERE user_id = $1`,
    [userId]
  );
};
