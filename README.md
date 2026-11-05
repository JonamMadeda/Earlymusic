# Luumbo

## UI Direction

The app now follows a warmer, more branded visual system with a soft ivory background, elevated glass-like panels, and stronger red accents for primary actions.

### Completed So Far

- Shared shell refreshed with a lighter gradient background and more distinct desktop framing.
- The app now uses a white base with subtle pastel banners and neutral cards for contrast.
- Header, sidebar, bottom nav, and player now use a more consistent card-and-pill language.
- The app shell is now flush between sidebar and main with smaller corner radii.
- The main header was removed since the sidebar now carries the app identity.
- The bottom player now uses a tighter layout with cleaner controls and time display.
- Home page now focuses on featured, newest, and recommended song rails.
- A dedicated `/songs` page now provides a clean, distraction-free full library view.
- The songs page now uses a slim search bar and filter toggle instead of a large banner or panel.
- Home and search banners now use softer pastel accents for visual contrast.
- Navigation now exposes the songs page across desktop and mobile entry points.
- Sidebar is reduced to a minimal primary nav plus account action.
- Search page now matches the same browsing language with better results density and a clearer empty state.
- Song rows now feel more premium with richer hover states, badges, and more deliberate spacing.
- Library and playlists empty states were aligned with the new visual tone.

### Next Phases

- Improve modal and admin surfaces.
- Add stronger loading states and micro-interactions.
- Refine playlist detail interactions and overall accessibility.

## App icons

Icon sources are SVGs in `scripts/assets/` (`icon.svg`, `mark.svg`, `maskable.svg`). Regenerate the PNG sizes, maskable icons, Apple touch icon, and favicon with:

```bash
npm run icons
```

This uses `sharp` from the existing install plus Pillow (`python`) to bundle the ICO.

## Cloudflare R2 uploads

Audio uploads use a short-lived presigned URL from `POST /api/upload`; R2 credentials stay on the server. Set `R2BUCKETNAME` in `.env.local` to the real bucket name before uploading.

Configure the R2 bucket CORS policy to allow browser `PUT` requests from your deployed site and `http://localhost:3000` during development:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://your-production-domain"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 3600
  }
]
```

The bytes go straight from the browser to R2, so two allow-lists have to agree: the bucket CORS above, and `connect-src` in `next.config.mjs`, which lists **both** `https://*.r2.dev` (playback) and `https://*.r2.cloudflarestorage.com` (the presigned `PUT` host). Drop the second and every upload fails with a bare "Failed to fetch" before the request ever leaves the browser.

Run `lib/migration.sql` in the Supabase SQL editor to create the `audio_tracks` table and its row-level security policies.

## Authentication (Neon Auth)

Authentication runs on **Neon Auth** (managed Better Auth) against the same Neon database. Users live in `neon_auth.user`, password hashes in `neon_auth.account`, and sessions in `neon_auth.session`.

| Setting | Value |
| --- | --- |
| Auth base URL | `https://ep-lively-mud-b58sauy3.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth` |
| JWKS URL | `https://ep-lively-mud-b58sauy3.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth/.well-known/jwks.json` |

Both are read from `NEON_AUTH_URL` / `NEON_AUTH_JWKS_URL` and fall back to the values above, so nothing has to be set for local development. `NEON_AUTH_ORIGIN` overrides the origin sent to Neon Auth (see *Trusted origins* below).

### Trusted origins (required in production)

Neon Auth rejects requests whose `Origin` is not trusted. Add the production domain in the Neon console under **Better Auth → Trusted origins** (localhost is allowed out of the box). Without it, sign-in and sign-up fail with `403 MISSING_OR_NULL_ORIGIN`.

The origin the app sends is derived from the incoming request, so it follows the deployed host automatically; set `NEON_AUTH_ORIGIN` explicitly when the request host is not the public one (for example behind a proxy that rewrites `Host`).

### Moving accounts from the old user tables

`scripts/migrate-users-to-neon-auth.mjs` moves every account from `public.users` into `neon_auth.user`, keeping the **same user ids** so playlists, saved songs and listening history stay attached to the right person. Profile names become `neon_auth.user.name`, and administrators become `neon_auth.user.role = 'admin'`.

```bash
node scripts/migrate-users-to-neon-auth.mjs            # dry run
node scripts/migrate-users-to-neon-auth.mjs --apply    # write
node scripts/migrate-users-to-neon-auth.mjs --verify   # compare both sides
```

Neon Auth hashes passwords with scrypt, which cannot be derived from the old bcrypt hashes. Those hashes are parked in `public.legacy_credentials` (created by `lib/migration-neon-auth.sql`, or by the script itself) and are converted on the owner's next sign-in: the app verifies the bcrypt hash once, writes the Neon Auth credential, and stamps `upgraded_at`. Until a user signs in again their account keeps working with the old password. **Admin → Insights** shows native-credential coverage and the number still pending; retire the bcrypt fallback only when pending reaches zero.

### Sessions

The browser holds the app's own `lumbo_session` cookie, whose value is Neon Auth's signed session value (`<token>.<hmac>`). Sessions are resolved by looking the token up in `neon_auth.session`, so a session can be revoked (or ended everywhere) by deleting its row. Sessions last 7 days and slide forward once they have been idle for a day.

### Password reset

Neon Auth owns this flow; the app only relays it. No SMTP key, sending domain or third-party account belongs to the app.

- `POST /api/auth/forgot-password` looks the address up in `neon_auth."user"` and answers with the same "if an account exists…" message whether or not it found one, so the form cannot be used to enumerate users. For a real account it calls Neon Auth's `request-password-reset` endpoint (Better Auth documents this path as `forget-password`; on the managed instance that path answers `404`). Neon mints the token, emails the link from the provider configured in its own console, and expires it after an hour. Limits: 5 requests per IP per 15 minutes and 3 per address per hour — worth having because Neon's shared sender is rate-limited.
- `POST /api/auth/reset-password` hands `{ token, newPassword }` to Neon Auth's `reset-password` endpoint, which writes the scrypt credential into `neon_auth.account` — creating that row for accounts migrated from the bcrypt hashes — and consumes the token, so a second use returns `INVALID_TOKEN`. This device's `lumbo_session` cookie is cleared on success.
- `app/reset-password/page.js` forwards `/reset-password?token=…` to `/auth?mode=reset&token=…`: that is the URL Neon's email carries, while this app's screen is the second.

Delivery needs **Settings → Better Auth → Sign-up with Email** enabled; with it off, no mail is sent. The emailed link is built from the **base URL** in that same console page, so it must read `https://luumbo.vercel.app` or the link points at the wrong host. The built-in sender delivers from `auth@mail.myneon.app` in Neon's own branding, which Neon documents as suitable for development and testing; before real traffic, set a custom email provider (or the `send.magic_link` webhook plus your own provider) there.

A reset completed inside Neon does not stamp `public.legacy_credentials.upgraded_at`, because the app never learns which account the token belonged to. Sign-in therefore skips the bcrypt fallback as soon as the account has a credential row, which is what keeps the pre-reset password from opening the account.

### Email verification

New sign-ups receive a six-digit code in a Neon-owned verification email and are not given an app session until the address is verified. `POST /api/auth/verify-email` relays the code to Neon's `email-otp/verify-email` endpoint; codes expire after five minutes. Unverified new accounts can request another code from the same screen, and accounts migrated from the legacy credential store remain signable so this change does not lock out existing listeners. The same Neon trusted-origin settings used by password reset must include the production site.

### Account lifecycle and retention

Signed-in listeners can permanently delete their account from `/account` after confirming their current password. Deleting `neon_auth.user` cascades through profiles, saved songs, playlists, sessions, and listening history; the legacy credential copy is removed explicitly. Audit events intentionally have no user foreign key, so a minimal `account_deleted` event remains after deletion.

`public.auth_events` is retained for 90 days and purged opportunistically as new events arrive. Passwords and raw tokens are never logged. Client-side production errors are rate-limited and stored in `public.app_errors` for 90 days; create that table with `lib/migration-app-errors.sql` before deploying the reporter.

Every step is written to `public.auth_events` as `password_reset_requested`, `password_reset_completed` or `password_reset_failed` — never with the token itself. A refused request records the Neon status and code, so production can be diagnosed without the Vercel logs:

```sql
select created_at, email, detail
  from public.auth_events
 where event = 'password_reset_requested'
 order by created_at desc
 limit 10;
```

`detail.send_failed` carries the status and code Neon returned — `403 MISSING_OR_NULL_ORIGIN` when this deployment's domain is missing from **Better Auth → Trusted origins**, `NEON_AUTH_UNAVAILABLE` when the auth endpoint could not be reached. A `200` with no mail in the inbox is the console's email provider, not this app.

### Names and the greeting

Sign-up asks for a first and last name and both are required: `POST /api/auth/register` rejects a request without them, and stores them as the single `neon_auth.user.name` display name (`"First Last"`). `GET /api/profiles/[id]` splits that back into `first_name`/`last_name` for the account screen, and the home page greeting uses only a real `first_name` — an email handle is never presented as a name. An account with no name gets "Good morning" with no name attached and an **Add your name** prompt on `/account`.

Accounts registered before the form asked for names were given the email's local part as their display name. `lib/migration-clear-placeholder-names.sql` blanks those (single-token names equal to the address prefix; real names are untouched) and must be run in every environment. `GET /api/profiles/[id]` also hides any such value that is still stored, so the greeting is correct before and after the migration.

### Legacy tables

`public.users`, `public.user_roles`, `public.user_sessions` and `public.profiles` are no longer read by the app. They are kept for reference until the migration is confirmed. `lib/migration-user-fks-to-neon-auth.sql` repoints the per-user data tables (`playlists`, `profiles`, `recently_played`, `saved_songs`, `user_roles`, `user_sessions`) at `neon_auth."user"` with `ON DELETE CASCADE`; before that they still referenced `public.users`, which made every write from a newly registered account fail with a 500. `public.auth_events.user_id` keeps no foreign key at all (`lib/migration-auth-events-user-id.sql`) because it must retain rows for accounts that have since been deleted.

## Administrator access

The `/admin` dashboard and the R2 signing endpoint require a Neon Auth account whose `role` is `admin` in `neon_auth.user`. Grant it from the **Administrator access** panel on `/admin`, or directly in SQL:

```sql
update neon_auth.user set role = 'admin' where email = 'admin@example.com';
```

Sign out and back in after changing a role.

## Announcements

`/notifications` is a public feed — listeners do not need an account, so it works as a broadcast channel for news, app updates, new song drops and warnings. The four kinds are `news`, `update`, `release` and `warning`, defined with their labels and colours in `lib/notifications.ts`.

- **Schema**: `public.notifications` is created by `lib/migration-notifications.sql`, applied with `node scripts/apply-sql-migration.mjs lib/migration-notifications.sql` (or paste it into the Neon SQL editor). Every migration file here is `CREATE ... IF NOT EXISTS`, so re-running is harmless. Until the table exists the feed reads as empty and the admin panel says so; nothing else in the app breaks.
- **The feed holds 15 announcements.** Posting a sixteenth deletes the oldest row in the same request (`MAX_NOTIFICATIONS` in `lib/notifications.ts`), so the list is always the newest fifteen. Deleting by hand is the only way to drop a row early.
- **Reading** is `GET /api/notifications` — no session required, rate limited, `no-store`. **Writing** is `/api/admin/notifications` (GET/POST/DELETE), which requires an admin session and records `notification.create` / `notification.delete` in the audit trail, visible on the admin **Activity** tab.
- **New tracks announce themselves.** A saved upload posts a `release` tile titled with the track name, linking to `/share/<id>` — the wording lives in `releaseAnnouncementFor` (`lib/notifications.ts`) and the write in `lib/announcement.ts`, which is the only path that inserts a row, so auto and hand-written announcements share the same cap. Deleting the track deletes its tile, so no announcement can point at a dead share page. Announcing never fails an upload: the audio and the song row are already committed, so a database hiccup is logged instead of thrown at the admin.
- **Posting** happens on the admin dashboard's **Notifications** tab. The optional link is limited to an in-app path (`/songs`) or an `https://` URL — `javascript:`, `data:`, `http:` and protocol-relative `//host` values are rejected before they reach the database.
- **Entry points**: a bell in the mobile top bar and a **Notifications** link in the desktop sidebar, both always present so listeners have a fixed place to return to; the empty feed just says "Nothing to report right now." An unread badge appears on either only when there is something new, and shows the exact count — at most 15, because the feed itself holds 15. Both share one client-side store (`lib/notificationFeed.js`) so the badge and the page agree. "Read" is per device, kept in `localStorage` — signing in does not sync it.
- **Nothing interrupts the listener.** There is no browser push permission, no `Notification`, no sound — announcements only appear when the app is opened or re-focused, which is when `lib/notificationFeed.js` re-reads the feed.

## Security operations

- **Audit trail**: run the SQL in `lib/migration.sql` (section 6) to create `public.admin_audit_log`. Grants, revokes, song deletions, and orphan cleanups are logged there automatically with actor, target, and timestamp.
- **Break-glass**: if administrator access is ever lost entirely, re-grant it with the SQL snippet above run as a database owner in the Neon SQL editor.
- **Rate limiting**: auth and admin API routes use durable counters in `public.auth_rate_limits`, shared by every server instance. A database failure fails open and is logged, so enforce hard limits at the host firewall/WAF as well.
- **Legacy storage**: all audio now lives on Cloudflare R2. The old Supabase `songs` storage bucket has no policies in `migration.sql` — delete the bucket (or add explicit deny policies) once you confirm nothing references it. The unused `audio_tracks` table is dropped by section 6 of the migration.
- **Accounts**: enable MFA and leaked-password protection for admin accounts in the Neon console. R2 audio URLs are permanent public links — treat them as unlisted, not secret.
- **JWT_SECRET**: no longer used. Sessions are signed by Neon Auth, so the variable can be dropped from `.env.local` and from your deployment environment.

## Verification and production setup

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. The GitHub Actions workflow in `.github/workflows/ci.yml` runs the same checks on pushes and pull requests and needs no secrets: the build job sets placeholder `NEON_DATABASE_URL` and `NEXT_PUBLIC_R2PUBLICURL` values because `next build` imports every route module to collect its configuration, so the Neon client must at least be constructible. Nothing in CI connects to the database or serves audio — the real values belong only to the Vercel project and to your local `.env.local`.

Vercel Analytics and Speed Insights are rendered from the root layout; enable both products for the Vercel project if they are not already enabled.

Two production changes require console/DNS access and cannot be completed in this repository:

1. **Branded authentication email:** in Neon Better Auth, replace the shared development sender with a verified custom provider and set the application name to **Luumbo**. Keep the base URL at `https://luumbo.vercel.app` and test both verification and reset emails afterward.
2. **Custom audio hostname:** attach a custom domain to the public R2 bucket in Cloudflare, then set both `NEXT_PUBLIC_R2PUBLICURL` and `R2PUBLICURL` to that HTTPS origin in Vercel and local development. Update any absolute `r2.dev` URLs already stored in `public.songs`; relative `song_path` values pick up the new origin automatically. The service worker matches `/audio/` by path, so it does not need another hostname change.
