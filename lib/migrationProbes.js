/**
 * Read-only presence probes for lib/migration*.sql.
 *
 * Most of these migrations were applied to production by hand in the Neon SQL
 * editor, before scripts/apply-sql-migration.mjs and its schema_migrations
 * table existed. So "recorded as run" and "present in the schema" are two
 * different questions, and only the first one can be answered from the
 * tracking table. Each probe here answers the second.
 *
 * Rules for a probe:
 *   - one SELECT, returning a single boolean column named `present`. No DDL,
 *     no DML (tests/migrationProbes.test.ts enforces this).
 *   - it must describe what the FILE guarantees, not one incidental column.
 *   - it must not error on a fresh branch: reference tables through
 *     to_regclass()/information_schema instead of a bare ::regclass cast, and
 *     require the object to exist before claiming a drop "already happened".
 *
 * A file with no entry classifies as "unknown" and --all will apply it, so the
 * test that every migration is covered here is what forces the decision when a
 * new schema file lands.
 */

/**
 * Supabase-era schema: auth.uid(), RLS policies, uuid_generate_v4(), a
 * profiles table keyed to Supabase auth. It cannot run against Neon and is
 * kept in the repo only as history, so it is never a target — not even via an
 * explicit file argument.
 */
export const SUPABASE_ONLY_MIGRATIONS = ["lib/migration.sql"];

export const presenceProbes = {
  "lib/migration-app-errors.sql": `
    SELECT to_regclass('public.app_errors') IS NOT NULL AS present`,

  // This file removes a foreign key, so it counts as present only when the
  // table exists and the key is genuinely gone.
  "lib/migration-auth-events-user-id.sql": `
    SELECT to_regclass('public.auth_events') IS NOT NULL
       AND NOT EXISTS (
            SELECT 1 FROM pg_constraint c
             WHERE c.conrelid = to_regclass('public.auth_events')
               AND c.conname  = 'auth_events_user_id_fkey') AS present`,

  "lib/migration-auth-hardening.sql": `
    SELECT to_regclass('public.user_sessions')    IS NOT NULL
       AND to_regclass('public.auth_rate_limits') IS NOT NULL
       AND to_regclass('public.auth_events')      IS NOT NULL AS present`,

  // The placeholder names this UPDATE clears are the ones /api/auth/register
  // used to synthesise from the email's local part.
  "lib/migration-clear-placeholder-names.sql": `
    SELECT to_regclass('neon_auth."user"') IS NOT NULL
       AND NOT EXISTS (
            SELECT 1 FROM neon_auth."user"
             WHERE btrim(COALESCE(name, '')) <> ''
               AND name NOT LIKE '% %'
               AND lower(btrim(name)) = split_part(lower(email), '@', 1)) AS present`,

  "lib/migration-core-tables.sql": `
    SELECT to_regclass('public.songs') IS NOT NULL
       AND EXISTS (
            SELECT 1 FROM pg_constraint c
             WHERE c.conrelid = to_regclass('public.profiles')
               AND c.conname  = 'profiles_id_fkey') AS present`,

  "lib/migration-legal.sql": `
    SELECT to_regclass('public.takedown_log') IS NOT NULL
       AND EXISTS (
            SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'songs'
               AND column_name = 'rights_clearance_date') AS present`,

  "lib/migration-legal-v2.sql": `
    SELECT to_regclass('public.consent_log') IS NOT NULL
       AND EXISTS (
            SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'dmca_reports'
               AND column_name = 'report_type') AS present`,

  "lib/migration-neon-auth.sql": `
    SELECT to_regclass('public.legacy_credentials') IS NOT NULL AS present`,

  "lib/migration-notification-state.sql": `
    SELECT to_regclass('public.notification_state') IS NOT NULL AS present`,

  "lib/migration-notifications.sql": `
    SELECT to_regclass('public.notifications') IS NOT NULL
       AND EXISTS (
             SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'notifications'
                AND column_name = 'target') AS present`,

  "lib/migration-standouts-rename.sql": `
    SELECT to_regclass('public.notifications') IS NOT NULL
       AND EXISTS (
             SELECT 1 FROM pg_constraint
              WHERE conname = 'notifications_target_check'
                AND pg_get_constraintdef(oid) ILIKE '%standouts%'
           )
       AND NOT EXISTS (
             SELECT 1 FROM public.notifications WHERE target = 'spotlight'
           ) AS present`,

  "lib/migration-picks.sql": `
    SELECT to_regclass('public.picks')       IS NOT NULL
       AND to_regclass('public.play_events') IS NOT NULL
       AND EXISTS (
            SELECT 1 FROM pg_constraint c
             WHERE c.conrelid = to_regclass('public.picks')
               AND c.conname  = 'picks_user_period_key') AS present`,

  "lib/migration-play-count.sql": `
    SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'recently_played'
               AND column_name = 'play_count') AS present`,

  // Vacuously present on an empty catalogue; that is the right answer, since
  // there is then nothing left to rewrite.
  "lib/migration-relative-song-paths.sql": `
    SELECT to_regclass('public.songs') IS NOT NULL
       AND NOT EXISTS (
            SELECT 1 FROM public.songs
             WHERE song_path LIKE 'https://%') AS present`,

  "lib/migration-song-fks.sql": `
    SELECT EXISTS (
             SELECT 1 FROM pg_constraint c
              WHERE c.conrelid = to_regclass('public.saved_songs')
                AND c.conname  = 'saved_songs_song_id_fkey')
       AND EXISTS (
             SELECT 1 FROM pg_constraint c
              WHERE c.conrelid = to_regclass('public.playlist_songs')
                AND c.conname  = 'playlist_songs_song_id_fkey')
       AND EXISTS (
             SELECT 1 FROM pg_constraint c
              WHERE c.conrelid = to_regclass('public.recently_played')
                AND c.conname  = 'recently_played_song_id_fkey')
       AND NOT EXISTS (
             SELECT 1 FROM pg_constraint c
              WHERE c.conrelid = to_regclass('public.dmca_reports')
                AND c.conname  = 'dmca_reports_song_id_fkey') AS present`,

  "lib/migration-token-version.sql": `
    SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'users'
               AND column_name = 'token_version') AS present`,

  "lib/migration-user-fks-to-neon-auth.sql": `
    SELECT EXISTS (
            SELECT 1 FROM pg_constraint c
              JOIN pg_class ref ON ref.oid = c.confrelid
              JOIN pg_namespace n ON n.oid = ref.relnamespace
             WHERE c.conrelid = to_regclass('public.playlists')
               AND c.conname  = 'playlists_user_id_fkey'
               AND n.nspname  = 'neon_auth') AS present`,
};

/**
 * @param file            repo-relative migration path
 * @param state.recorded  the tracking table has a row for it
 * @param state.probeResult  true | false | null (probe errored) | undefined (no probe)
 */
export const classifyMigration = (file, { recorded, probeResult }) => {
  if (SUPABASE_ONLY_MIGRATIONS.includes(file)) return "supabase-only";
  if (recorded) return "recorded";
  if (probeResult === undefined) return "unknown";
  if (probeResult === null) return "probe-failed";
  return probeResult ? "present" : "missing";
};

// probe-failed is deliberately excluded: a transient error must not turn into
// an unintended DDL run. Fix the probe, or name the file explicitly.
export const shouldApply = (kind) => kind === "missing" || kind === "unknown";
