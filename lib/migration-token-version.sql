-- Run this in the Neon SQL editor (one time) to enable session
-- revocation on password change.
--
-- Adds a token_version counter to public.users. Password changes bump it,
-- which invalidates every previously issued JWT (each token carries the
-- version it was signed with). The app works without this column too —
-- auth falls back to accepting tokens — but revocation only applies after
-- this has run.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1;
