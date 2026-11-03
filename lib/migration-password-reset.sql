-- Single-use password reset tokens.
--
-- Neon Auth mints reset tokens in neon_auth.verification but the managed
-- service is not configured to send email, so no link can ever reach a
-- user. The app therefore owns the reset flow: it stores only a SHA-256
-- hash of the token here, so a database read cannot hand out live links,
-- and the raw token exists only inside the email.
--
-- Run this in the Neon SQL editor.

CREATE TABLE IF NOT EXISTS public.password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES neon_auth."user" (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS password_resets_user_id_idx
  ON public.password_resets (user_id);

CREATE INDEX IF NOT EXISTS password_resets_expires_at_idx
  ON public.password_resets (expires_at);
