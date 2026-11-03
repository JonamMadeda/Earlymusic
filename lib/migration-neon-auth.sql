-- Credentials for accounts that predate Neon Auth.
--
-- Neon Auth stores password hashes with Better Auth's scrypt scheme, which
-- cannot be derived from a bcrypt hash. Accounts that existed before the
-- move keep their bcrypt hash here until their owner signs in once: that
-- sign-in verifies the hash, writes the scrypt credential into
-- neon_auth.account, and stamps upgraded_at on this row.
--
-- Run this in the Neon SQL editor, or let
-- scripts/migrate-users-to-neon-auth.mjs create it.

CREATE TABLE IF NOT EXISTS public.legacy_credentials (
  user_id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  upgraded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS legacy_credentials_email_idx
  ON public.legacy_credentials (lower(email));
