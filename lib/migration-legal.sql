-- Legal & rights management migration
-- Run in the Neon SQL editor. All statements are IF NOT EXISTS / additive.

-- 1. Song rights & moderation columns
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS copyright_holder TEXT,
  ADD COLUMN IF NOT EXISTS license_type TEXT,
  ADD COLUMN IF NOT EXISTS license_url TEXT,
  ADD COLUMN IF NOT EXISTS rights_clearance_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS region_restricted BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for public listing by status
CREATE INDEX IF NOT EXISTS songs_status_idx ON public.songs (status);

-- 2. DMCA / infringement reports
CREATE TABLE IF NOT EXISTS public.dmca_reports (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

ALTER TABLE public.dmca_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can create DMCA reports" ON public.dmca_reports;
CREATE POLICY "Anyone can create DMCA reports"
  ON public.dmca_reports FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can manage DMCA reports" ON public.dmca_reports;
CREATE POLICY "Admins can manage DMCA reports"
  ON public.dmca_reports FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

-- 3. Takedown log (audit trail of content removals)
CREATE TABLE IF NOT EXISTS public.takedown_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  song_id      BIGINT NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  song_title   TEXT,
  actor_id     UUID REFERENCES neon_auth."user"(id) ON DELETE SET NULL,
  reason       TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.takedown_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view takedown log" ON public.takedown_log;
CREATE POLICY "Admins can view takedown log"
  ON public.takedown_log FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin()));

-- Writes use the service-role key inside API routes.

-- 4. Terms / Privacy acceptance tracking on Neon Auth users
ALTER TABLE neon_auth."user"
  ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ;
