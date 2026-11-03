-- Repoint the per-user data tables at Neon Auth.
--
-- These foreign keys targeted public.users, the table the app read accounts
-- from before the move. Registrations now land in neon_auth."user" only, so
-- every new account failed the old constraint: signing up worked, but the
-- first play (or save, or playlist) returned 500 from /api/data/*.
--
-- neon_auth."user" is the authoritative account store, so the keys point
-- there and keep ON DELETE CASCADE, which is what makes "delete this account"
-- in the admin screen clean up after itself.
--
-- Safe to re-run. Requires lib/migration-users.sql / the Neon Auth user copy
-- in scripts/migrate-users-to-neon-auth.mjs to have completed first, because
-- the new keys validate every existing child row against neon_auth."user".

BEGIN;

ALTER TABLE public.playlists
  DROP CONSTRAINT IF EXISTS playlists_user_id_fkey,
  ADD CONSTRAINT playlists_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES neon_auth."user"(id) ON DELETE CASCADE;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey,
  ADD CONSTRAINT profiles_id_fkey
    FOREIGN KEY (id) REFERENCES neon_auth."user"(id) ON DELETE CASCADE;

ALTER TABLE public.recently_played
  DROP CONSTRAINT IF EXISTS recently_played_user_id_fkey,
  ADD CONSTRAINT recently_played_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES neon_auth."user"(id) ON DELETE CASCADE;

ALTER TABLE public.saved_songs
  DROP CONSTRAINT IF EXISTS saved_songs_user_id_fkey,
  ADD CONSTRAINT saved_songs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES neon_auth."user"(id) ON DELETE CASCADE;

ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey,
  ADD CONSTRAINT user_roles_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES neon_auth."user"(id) ON DELETE CASCADE;

ALTER TABLE public.user_sessions
  DROP CONSTRAINT IF EXISTS user_sessions_user_id_fkey,
  ADD CONSTRAINT user_sessions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES neon_auth."user"(id) ON DELETE CASCADE;

COMMIT;
