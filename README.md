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

Neon Auth hashes passwords with scrypt, which cannot be derived from the old bcrypt hashes. Those hashes are parked in `public.legacy_credentials` (created by `lib/migration-neon-auth.sql`, or by the script itself) and are converted on the owner's next sign-in: the app verifies the bcrypt hash once, writes the Neon Auth credential, and stamps `upgraded_at`. Until a user signs in again their account keeps working with the old password.

### Sessions

The browser holds the app's own `lumbo_session` cookie, whose value is Neon Auth's signed session value (`<token>.<hmac>`). Sessions are resolved by looking the token up in `neon_auth.session`, so a session can be revoked (or ended everywhere) by deleting its row. Sessions last 7 days and slide forward once they have been idle for a day.

### Password reset

Neon Auth does not send email, so the reset link is delivered by this app. Two routes own the flow:

- `POST /api/auth/forgot-password` looks the address up in `neon_auth."user"` and answers with the same "if an account exists…" message whether or not it found one, so the form cannot be used to enumerate users. It issues a 32-byte random token, stores only its SHA-256 hash in `public.password_resets` (`lib/migration-password-reset.sql`) with a 30-minute expiry, invalidates any earlier token for that account, and emails `${origin}/auth?mode=reset&token=…`. Limits: 5 requests per IP per 15 minutes and 3 per address per hour.
- `POST /api/auth/reset-password` claims the token atomically (single-use, `UPDATE … WHERE used_at IS NULL RETURNING`), writes the new scrypt credential, deletes every row in `neon_auth.session` for that user so all other devices are signed out, and clears this device's cookie. Accounts that had never signed in since the migration get a real Neon Auth credential here too, and their `public.legacy_credentials` row is stamped `upgraded_at` — which is what stops the previous password from still working through the legacy fallback.

Reset links need an email provider: **Resend**. Create an account, verify your sending domain, then set

```bash
RESEND_API_KEY=re_...
EMAIL_FROM=Luumbo <no-reply@your-domain.example>
```

Both are required; `EMAIL_FROM` must use a domain you verified in Resend. With them set, `lib/email.ts` posts to the Resend HTTP API (no SDK, 10s timeout) and a failed send is recorded in `public.auth_events` with `delivery_failed`. Without them, development prints the link on the forgot-password screen under **LOCAL DEVELOPMENT** (never in production, where the request just reports that delivery failed).

Every step is written to `public.auth_events` as `password_reset_requested`, `password_reset_completed` or `password_reset_failed` — never with the token itself.

### Legacy tables

`public.users`, `public.user_roles`, `public.user_sessions` and `public.profiles` are no longer read by the app. They are kept for reference until the migration is confirmed. `lib/migration-user-fks-to-neon-auth.sql` repoints the per-user data tables (`playlists`, `profiles`, `recently_played`, `saved_songs`, `user_roles`, `user_sessions`) at `neon_auth."user"` with `ON DELETE CASCADE`; before that they still referenced `public.users`, which made every write from a newly registered account fail with a 500. `public.auth_events.user_id` keeps no foreign key at all (`lib/migration-auth-events-user-id.sql`) because it must retain rows for accounts that have since been deleted.

## Administrator access

The `/admin` dashboard and the R2 signing endpoint require a Neon Auth account whose `role` is `admin` in `neon_auth.user`. Grant it from the **Administrator access** panel on `/admin`, or directly in SQL:

```sql
update neon_auth.user set role = 'admin' where email = 'admin@example.com';
```

Sign out and back in after changing a role.

## Security operations

- **Audit trail**: run the SQL in `lib/migration.sql` (section 6) to create `public.admin_audit_log`. Grants, revokes, song deletions, and orphan cleanups are logged there automatically with actor, target, and timestamp.
- **Break-glass**: if administrator access is ever lost entirely, re-grant it with the SQL snippet above run as a database owner in the Neon SQL editor.
- **Rate limiting**: admin API routes throttle per IP (generous burst limits for bulk operations). Counts are per server instance — enforce hard limits at your host firewall/WAF as well.
- **Legacy storage**: all audio now lives on Cloudflare R2. The old Supabase `songs` storage bucket has no policies in `migration.sql` — delete the bucket (or add explicit deny policies) once you confirm nothing references it. The unused `audio_tracks` table is dropped by section 6 of the migration.
- **Accounts**: enable MFA and leaked-password protection for admin accounts in the Neon console. R2 audio URLs are permanent public links — treat them as unlisted, not secret.
- **JWT_SECRET**: no longer used. Sessions are signed by Neon Auth, so the variable can be dropped from `.env.local` and from your deployment environment.
