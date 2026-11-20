CREATE TABLE IF NOT EXISTS public.notifications (
  id          bigserial PRIMARY KEY,
  kind        text        NOT NULL DEFAULT 'news',
  title       text        NOT NULL,
  body        text,
  url         text,
  target      text        NOT NULL DEFAULT 'general',
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_kind_check
    CHECK (kind IN ('news', 'update', 'release', 'warning')),
  CONSTRAINT notifications_target_check
    CHECK (target IN ('general', 'standouts', 'top', 'picks', 'highlights'))
);

-- Announcements that point at the Library are read by the nudge badge, so the
-- target is part of the hot path too. ADD COLUMN keeps older installs current.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS target text NOT NULL DEFAULT 'general';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_target_check'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_target_check
      CHECK (target IN ('general', 'standouts', 'top', 'picks', 'highlights'));
  END IF;
END $$;

-- Every read is "the newest 15", so the list query must never sort a growing
-- heap. Nothing references neon_auth."user": announcements outlive the admin
-- who posted them, exactly like public.auth_events.
CREATE INDEX IF NOT EXISTS notifications_created_at_idx
  ON public.notifications (created_at DESC);
