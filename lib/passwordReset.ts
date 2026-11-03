import { createHash, randomBytes } from "node:crypto";
import { db } from "./neon";

export const RESET_TOKEN_TTL_MINUTES = 30;

const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

/**
 * Password reset tokens.
 *
 * Only the SHA-256 of the token is stored, so reading the table cannot
 * produce a working link. Issuing a token invalidates any earlier ones for
 * that account, which keeps a leaked old email from staying usable.
 */
export const issueResetToken = async (
  userId: string
): Promise<{ token: string; expiresAt: string } | null> => {
  const token = randomBytes(32).toString("base64url");

  // Invalidate outstanding tokens first: a second request must not leave
  // the first link alive.
  await db.query(`DELETE FROM public.password_resets WHERE user_id = $1`, [
    userId,
  ]);

  const { rows } = await db.query(
    `INSERT INTO public.password_resets (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + make_interval(mins => $3::int))
     RETURNING expires_at`,
    [userId, hashToken(token), RESET_TOKEN_TTL_MINUTES]
  );

  const expiresAt = rows?.[0]?.expires_at;
  return expiresAt ? { token, expiresAt } : null;
};

/**
 * Atomically claims a valid token and returns its owner. The guard lives in
 * the UPDATE itself so a replayed token cannot be spent twice.
 */
export const consumeResetToken = async (
  token: string
): Promise<{ userId: string } | null> => {
  if (typeof token !== "string" || token.length < 16 || token.length > 512) {
    return null;
  }

  const { rows } = await db.query(
    `UPDATE public.password_resets
     SET used_at = now()
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
     RETURNING user_id`,
    [hashToken(token)]
  );

  const userId = rows?.[0]?.user_id;
  return userId ? { userId } : null;
};

/**
 * Best-effort housekeeping; expired or spent rows have no further use.
 */
export const purgeResetTokens = async (): Promise<void> => {
  try {
    await db.query(
      `DELETE FROM public.password_resets
       WHERE expires_at < now() - interval '1 day'
          OR used_at < now() - interval '1 day'`
    );
  } catch (error) {
    console.error("Unable to purge reset tokens:", error);
  }
};
