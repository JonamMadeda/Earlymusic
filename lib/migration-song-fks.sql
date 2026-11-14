-- Referential integrity around public.songs.
--
-- lib/migration-user-fks-to-neon-auth.sql repointed every user_id key at
-- neon_auth."user" but left every song_id column unconstrained, so deleting a
-- track silently strands rows in listeners' libraries, playlists and history.
--
-- Verified against production on 2026-11-13: zero dangling song_id rows in
-- saved_songs, playlist_songs or recently_played. That is why these constraints
-- can be added directly; once a song is deleted without them, a backfill is
-- needed to clear the orphans before ALTER TABLE will validate.
--
-- Safe to re-run: every block checks pg_constraint first.

DO $song_fks$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.saved_songs'::regclass
       AND conname = 'saved_songs_song_id_fkey'
  ) THEN
    ALTER TABLE public.saved_songs
      ADD CONSTRAINT saved_songs_song_id_fkey
      FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.playlist_songs'::regclass
       AND conname = 'playlist_songs_song_id_fkey'
  ) THEN
    ALTER TABLE public.playlist_songs
      ADD CONSTRAINT playlist_songs_song_id_fkey
      FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.recently_played'::regclass
       AND conname = 'recently_played_song_id_fkey'
  ) THEN
    ALTER TABLE public.recently_played
      ADD CONSTRAINT recently_played_song_id_fkey
      FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE;
  END IF;
END
$song_fks$;

-- dmca_reports must outlive the track it reports on.
--
-- The existing ON DELETE CASCADE deletes a copyright complaint the moment an
-- admin removes the song, which destroys exactly the record a DMCA response
-- needs. ON DELETE SET NULL is not an option: song_id is NOT NULL, and relaxing
-- that would discard which track the report concerned. So the key is dropped
-- and song_id kept as a plain id, matching how lib/migration-legal.sql treats
-- public.takedown_log.
DO $dmca$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.dmca_reports'::regclass
       AND conname = 'dmca_reports_song_id_fkey'
  ) THEN
    ALTER TABLE public.dmca_reports
      DROP CONSTRAINT dmca_reports_song_id_fkey;
  END IF;
END
$dmca$;
