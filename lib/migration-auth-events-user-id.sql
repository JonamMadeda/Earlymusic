-- Audit trail for accounts that live in Neon Auth.
--
-- public.auth_events.user_id carried a foreign key to public.users, the
-- pre-Neon-Auth account table. New registrations are written to
-- neon_auth."user" only, so every audit insert for a new account was
-- rejected by that key and silently dropped by the best-effort logger —
-- logins, failed logins and password resets left no trace.
--
-- The column is now a plain UUID: the audit log records the id of whoever
-- acted, whether or not that id also exists in the legacy table.
--
-- Run this in the Neon SQL editor.

ALTER TABLE public.auth_events
  DROP CONSTRAINT IF EXISTS auth_events_user_id_fkey;

CREATE INDEX IF NOT EXISTS auth_events_user_id_idx
  ON public.auth_events (user_id);
