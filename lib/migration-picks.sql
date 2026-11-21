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

-- Do NOT seed play_events from recently_played. It only keeps one lifetime
-- row per song, so copying it creates one "play" at each song's last listen and
-- makes that song win day, week and year at the same time. Highlights start
-- empty and fill from real plays recorded by the player. An older install can
-- remove the old snapshot rows with:
--
--   DELETE FROM public.play_events pe
--    USING public.recently_played rp
--    WHERE pe.user_id = rp.user_id
--      AND pe.song_id = rp.song_id
--      AND pe.played_at = rp.played_at;
