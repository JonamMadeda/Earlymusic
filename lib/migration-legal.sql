-- Legal & rights management migration
-- Run in the Neon SQL editor. All statements are IF NOT EXISTS / additive.

-- 1. Song rights & moderation columns
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS copyright_holder TEXT,
  ADD COLUMN IF NOT EXISTS license_type TEXT,
  ADD COLUMN IF NOT EXISTS license_url TEXT,
  ADD COLUMN IF NOT EXISTS rights_clearance_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS region_restricted BOOLEAN NOT NULL DEFAULT FALSE;

-- ADD COLUMN IF NOT EXISTS is a no-op on already-migrated databases, so set
-- the pending-by-default policy explicitly; SET DEFAULT is safe to re-run.
ALTER TABLE public.songs ALTER COLUMN status SET DEFAULT 'pending';

-- Index for public listing by status
CREATE INDEX IF NOT EXISTS songs_status_idx ON public.songs (status);

-- 2. DMCA / infringement reports
CREATE TABLE IF NOT EXISTS public.dmca_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id       BIGINT NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  reporter_name TEXT,
  reporter_email TEXT,
  reason        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'reviewed', 'resolved', 'dismissed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ,
  resolved_by   UUID REFERENCES neon_auth."user"(id) ON DELETE SET NULL
);

-- No RLS here: the app reaches Postgres only through server routes using the
-- database owner role, and every other public table also runs without RLS.
-- If you later expose these tables to a browser client, enable RLS and add a
-- working admin predicate first (the old policy referenced a non-existent
-- public.is_admin() function).

-- 3. Takedown log (audit trail of content removals)
-- song_id deliberately has no foreign key: a takedown record must outlive the
-- song it documents, and the route writes it after the song row is deleted.
CREATE TABLE IF NOT EXISTS public.takedown_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id      BIGINT NOT NULL,
  song_title   TEXT,
  actor_id     UUID REFERENCES neon_auth."user"(id) ON DELETE SET NULL,
  reason       TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Older deployments created this table with an ON DELETE CASCADE FK, which
-- both rejected the post-delete insert and would have erased the audit row.
ALTER TABLE public.takedown_log
  DROP CONSTRAINT IF EXISTS takedown_log_song_id_fkey;

-- RLS intentionally omitted; see the note above dmca_reports.
-- Writes use the service-role key inside API routes.

-- 4. Terms / Privacy acceptance tracking on Neon Auth users
ALTER TABLE neon_auth."user"
  ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ;
