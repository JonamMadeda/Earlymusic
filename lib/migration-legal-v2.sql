-- Legal & compliance migration v2
-- Run in the Neon SQL editor (or with scripts/apply-legal-migration). Every
-- statement is additive / IF NOT EXISTS so it is safe to re-run.

-- 1. Structured copyright notices on dmca_reports ---------------------------
-- The original table only stored a free-text reason. A statutory notice needs
-- the work, the allegedly infringing URL, contact details, a signature, and
-- the good-faith / accuracy / authority statements (17 U.S.C. 512(c)(3)).
ALTER TABLE public.dmca_reports
  ADD COLUMN IF NOT EXISTS report_type TEXT NOT NULL DEFAULT 'other'
    CHECK (report_type IN ('copyright', 'other')),
  ADD COLUMN IF NOT EXISTS copyrighted_work TEXT,
  ADD COLUMN IF NOT EXISTS infringing_url TEXT,
  ADD COLUMN IF NOT EXISTS reporter_address TEXT,
  ADD COLUMN IF NOT EXISTS reporter_phone TEXT,
  ADD COLUMN IF NOT EXISTS signature TEXT,
  ADD COLUMN IF NOT EXISTS good_faith BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS accuracy_penalty BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS authorized_agent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS resolution_note TEXT,
  ADD COLUMN IF NOT EXISTS reply_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS dmca_reports_status_created_idx
  ON public.dmca_reports (status, created_at DESC);

-- 2. Per-track availability ------------------------------------------------
-- download_allowed lets a streaming-only licence hide the offline download
-- action. allowed_countries is an ISO-3166 alpha-2 allowlist used when
-- region_restricted is true.
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS download_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allowed_countries TEXT[];

-- 3. Policy versions and age attestation -----------------------------------
ALTER TABLE neon_auth."user"
  ADD COLUMN IF NOT EXISTS terms_version TEXT,
  ADD COLUMN IF NOT EXISTS privacy_version TEXT,
  ADD COLUMN IF NOT EXISTS age_attested_at TIMESTAMPTZ;

-- 4. Server-side consent log ------------------------------------------------
-- Analytics consent is still stored locally, but this records the choice
-- (and the Terms / Privacy / age acknowledgements) so the app can evidence
-- consent if a regulator or user asks.
CREATE TABLE IF NOT EXISTS public.consent_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES neon_auth."user"(id) ON DELETE SET NULL,
  kind           TEXT NOT NULL
    CHECK (kind IN ('analytics', 'terms', 'privacy', 'age')),
  granted        BOOLEAN,
  policy_version TEXT,
  ip             TEXT,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS consent_log_user_created_idx
  ON public.consent_log (user_id, created_at DESC);

-- 5. Takedown log convenience index ---------------------------------------
CREATE INDEX IF NOT EXISTS takedown_log_created_idx
  ON public.takedown_log (created_at DESC);

-- No RLS: the app reaches Postgres only through server routes using the
-- database owner role, matching every other public table in this schema.
