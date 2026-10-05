-- Run this in the Neon SQL editor (one time) to enable per-user
-- "Most listened" counts on the Library page.
--
-- Adds a play_count column to public.recently_played. The data API bumps it
-- (+1) on every synced play; existing rows start at 1 so rankings build
-- from here forward.

ALTER TABLE public.recently_played
  ADD COLUMN IF NOT EXISTS play_count INTEGER NOT NULL DEFAULT 1;

-- Backfill: rows created before this column existed count as one play.
UPDATE public.recently_played
SET play_count = 1
WHERE play_count IS NULL;
