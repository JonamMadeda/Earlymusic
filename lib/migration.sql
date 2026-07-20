-- Run this SQL in your Supabase SQL Editor (Dashboard > SQL Editor)
-- Creates tables needed for auth-backed playlists and saved songs

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ADMINISTRATOR ROLES
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view songs" ON public.songs;
CREATE POLICY "Anyone can view songs"
  ON public.songs FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Administrators can manage songs" ON public.songs;
CREATE POLICY "Administrators can manage songs"
  ON public.songs FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

-- 1. PLAYLISTS table
CREATE TABLE IF NOT EXISTS public.playlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own playlists" ON public.playlists;
CREATE POLICY "Users can view their own playlists"
  ON public.playlists FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own playlists" ON public.playlists;
CREATE POLICY "Users can create their own playlists"
  ON public.playlists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own playlists" ON public.playlists;
CREATE POLICY "Users can update their own playlists"
  ON public.playlists FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own playlists" ON public.playlists;
CREATE POLICY "Users can delete their own playlists"
  ON public.playlists FOR DELETE
  USING (auth.uid() = user_id);

-- 2. PLAYLIST SONGS table
CREATE TABLE IF NOT EXISTS public.playlist_songs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  playlist_id UUID REFERENCES public.playlists(id) ON DELETE CASCADE NOT NULL,
  song_id BIGINT REFERENCES public.songs(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(playlist_id, song_id)
);

ALTER TABLE public.playlist_songs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view songs in their playlists" ON public.playlist_songs;
CREATE POLICY "Users can view songs in their playlists"
  ON public.playlist_songs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.playlists
      WHERE playlists.id = playlist_id AND playlists.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can add songs to their playlists" ON public.playlist_songs;
CREATE POLICY "Users can add songs to their playlists"
  ON public.playlist_songs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.playlists
      WHERE playlists.id = playlist_id AND playlists.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can remove songs from their playlists" ON public.playlist_songs;
CREATE POLICY "Users can remove songs from their playlists"
  ON public.playlist_songs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.playlists
      WHERE playlists.id = playlist_id AND playlists.user_id = auth.uid()
    )
  );

-- 3. SAVED SONGS (Library) table
CREATE TABLE IF NOT EXISTS public.saved_songs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  song_id BIGINT REFERENCES public.songs(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, song_id)
);

ALTER TABLE public.saved_songs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their saved songs" ON public.saved_songs;
CREATE POLICY "Users can view their saved songs"
  ON public.saved_songs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can save songs" ON public.saved_songs;
CREATE POLICY "Users can save songs"
  ON public.saved_songs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unsave songs" ON public.saved_songs;
CREATE POLICY "Users can unsave songs"
  ON public.saved_songs FOR DELETE
  USING (auth.uid() = user_id);

-- 4. RECENTLY PLAYED table (persists listening history across devices)
CREATE TABLE IF NOT EXISTS public.recently_played (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  song_id BIGINT REFERENCES public.songs(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, song_id)
);

ALTER TABLE public.recently_played ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their recently played" ON public.recently_played;
CREATE POLICY "Users can view their recently played"
  ON public.recently_played FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert recently played" ON public.recently_played;
CREATE POLICY "Users can insert recently played"
  ON public.recently_played FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update recently played" ON public.recently_played;
CREATE POLICY "Users can update recently played"
  ON public.recently_played FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete from recently played" ON public.recently_played;
CREATE POLICY "Users can delete from recently played"
  ON public.recently_played FOR DELETE
  USING (auth.uid() = user_id);

-- 5. R2-BACKED AUDIO TRACKS
CREATE TABLE IF NOT EXISTS public.audio_tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  public_storage_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audio_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view audio tracks" ON public.audio_tracks;
CREATE POLICY "Authenticated users can view audio tracks"
  ON public.audio_tracks FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can add their own audio tracks" ON public.audio_tracks;
CREATE POLICY "Users can add their own audio tracks"
  ON public.audio_tracks FOR INSERT
  WITH CHECK (auth.uid() = user_id);
