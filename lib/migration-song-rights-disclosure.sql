-- Structured, listener-facing rights classification for the worship archive.
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS rights_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (rights_status IN ('church_original', 'third_party', 'public_domain', 'unknown')),
  ADD COLUMN IF NOT EXISTS rights_note TEXT;
