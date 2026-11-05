CREATE TABLE IF NOT EXISTS public.notifications (
  id          bigserial PRIMARY KEY,
  kind        text        NOT NULL DEFAULT 'news',
  title       text        NOT NULL,
  body        text,
  url         text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_kind_check
    CHECK (kind IN ('news', 'update', 'release', 'warning'))
);

-- Every read is "the newest 15", so the list query must never sort a growing
-- heap. Nothing references neon_auth."user": announcements outlive the admin
-- who posted them, exactly like public.auth_events.
CREATE INDEX IF NOT EXISTS notifications_created_at_idx
  ON public.notifications (created_at DESC);
