-- Per-user notification read state and preferences.
--
-- Announcements are a public broadcast, but "what this listener has read" and
-- "how often the Library dot may appear" belong to the account. They used to
-- live only in localStorage, so signing in on another device lost them. The
-- client keeps its local cache for signed-out listeners and syncs this single
-- row when authenticated; the notification endpoints degrade quietly when the
-- table has not been applied yet.
--
-- Apply with:
--   node scripts/apply-sql-migration.mjs lib/migration-notification-state.sql

CREATE TABLE IF NOT EXISTS public.notification_state (
  user_id       UUID        PRIMARY KEY REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  -- Kept as TEXT because the client's seen mark is an ISO timestamp string.
  seen_at       TEXT,
  dismissed_ids JSONB       NOT NULL DEFAULT '[]'::jsonb,
  read_ids      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  -- Nudge seen keys, snooze time and the chosen mode, in one small blob.
  nudge         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  preferences   JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
