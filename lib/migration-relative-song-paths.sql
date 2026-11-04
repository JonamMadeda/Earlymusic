-- Normalize public.songs.song_path from absolute R2 public URLs to
-- hostname-relative `/audio/<key>` paths, so moving to a custom audio
-- hostname later is an env-variable change (NEXT_PUBLIC_R2PUBLICURL /
-- R2PUBLICURL) with no data rewrite. lib/audioUrl.js re-prefixes the
-- stored path for every client.
--
-- Idempotent: rows already stored as `/audio/...` are not touched.
-- Safe to run while the old (absolute-only) build is deployed only in
-- one direction: getAudioPublicUrl has always resolved relative paths,
-- so already-deployed clients keep working after this UPDATE.

update public.songs
   set song_path = substring(song_path from length('https://pub-689c88e5cea643f48059e6ea3c3f8923.r2.dev') + 1)
 where song_path like 'https://pub-689c88e5cea643f48059e6ea3c3f8923.r2.dev/%';
