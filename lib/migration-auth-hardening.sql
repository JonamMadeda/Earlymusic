-- Auth hardening migration (Neon / PostgreSQL).
--
-- Run once in the Neon SQL editor before deploying the auth changes.
-- Everything here is additive and safe to re-run.
--
-- 1. user_sessions  — server-side session records. JWTs carry a `sid`
--    claim that must map to a live row, so signing out one device can
--    revoke exactly that session (token_version still revokes all).
-- 2. auth_rate_limits — durable rate-limit buckets shared by every
--    server instance (the old in-memory limiter was per-process).
-- 3. auth_events — append-only audit trail for login / logout /
--    registration / password changes.
-- 4. users_email_lower_key — prevents case-variant duplicate accounts.

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  user_agent TEXT,
  ip TEXT
);

CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx
  ON public.user_sessions (user_id);

CREATE INDEX IF NOT EXISTS user_sessions_expires_at_idx
  ON public.user_sessions (expires_at);

CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS auth_rate_limits_reset_at_idx
  ON public.auth_rate_limits (reset_at);

CREATE TABLE IF NOT EXISTS public.auth_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  email TEXT,
  event TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_events_created_at_idx
  ON public.auth_events (created_at DESC);

CREATE INDEX IF NOT EXISTS auth_events_user_id_idx
  ON public.auth_events (user_id);

CREATE INDEX IF NOT EXISTS auth_events_event_idx
  ON public.auth_events (event);

-- Login normalises email to lower-case; make the database enforce that
-- there can only ever be one row per case-insensitive address.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key
  ON public.users (lower(email));
