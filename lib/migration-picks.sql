-- Library "Picks" and "Highlights".
--
-- picks:        one saved pick per user and period (day/week/month/year).
-- play_events:  one row per play, so "song of the day/week/month/year" can
--               count plays that actually happened inside each period.
--               recently_played only keeps the latest play per song, which
--               cannot answer period questions.
--
-- Apply with:
--   node scripts/apply-sql-migration.mjs lib/migration-picks.sql

CREATE TABLE IF NOT EXISTS public.picks (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  song_id     BIGINT      NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  period      TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT picks_period_check
    CHECK (period IN ('day', 'week', 'month', 'year')),
  CONSTRAINT picks_user_period_key UNIQUE (user_id, period)
);

CREATE TABLE IF NOT EXISTS public.play_events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  song_id     BIGINT      NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  played_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Every highlight read filters one user's events by a period start.
CREATE INDEX IF NOT EXISTS play_events_user_played_idx
  ON public.play_events (user_id, played_at DESC);

-- Seed from the existing history so highlights are not blank on day one.
-- recently_played holds at most the ten most recent songs per listener and
-- their latest play timestamp; each becomes one starting event. The NOT
-- EXISTS keeps a re-run from duplicating a row that is already present.
INSERT INTO public.play_events (user_id, song_id, played_at)
SELECT rp.user_id, rp.song_id, rp.played_at
  FROM public.recently_played rp
 WHERE rp.played_at IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM public.play_events pe
      WHERE pe.user_id = rp.user_id
        AND pe.song_id = rp.song_id
        AND pe.played_at = rp.played_at
   );
