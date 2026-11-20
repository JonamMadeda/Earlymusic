-- The Library's Spotlight section is now Standouts. Announcements already in
-- the feed carry the old target string, so rewrite them before reinstating the
-- check constraint. Drop the constraint first: it still rejects 'standouts'
-- until the new definition is in place.
--
-- Re-run safe: the rewrite is a no-op once no rows use the old target, and the
-- constraint is recreated only when absent.
--
-- Apply with:
--   node scripts/apply-sql-migration.mjs lib/migration-standouts-rename.sql

DO $$
BEGIN
  IF to_regclass('public.notifications') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS notifications_target_check;

  UPDATE public.notifications
     SET target = 'standouts'
   WHERE target = 'spotlight';

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_target_check'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_target_check
      CHECK (target IN ('general', 'standouts', 'top', 'picks', 'highlights'));
  END IF;
END $$;
