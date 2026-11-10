# Legal Considerations — Luumbo

**Disclaimer:** I am not an attorney. This document is an internal reference,
not legal advice. Have a qualified lawyer review your Terms of Service, Privacy
Policy, and licensing arrangements before launching publicly.

The published documents live at `app/terms/page.js` and `app/privacy/page.js`
(rendered by the shared `app/components/LegalPage.jsx`). Contact details and
policy dates come from `lib/legal.js`, so those pages and the footer stay in
sync.

## 1. Copyright & licensing

### Concern
Worship songs are typically copyrighted. A church's right to perform a song
congregationally (e.g. via CCLI) does not automatically cover recording,
reproducing, or streaming that performance to the public. You likely need:

- **Mechanical licenses** to reproduce and distribute the recordings.
- **Public performance / streaming licenses** to make the audio available
  through the app.
- Confirmation of who owns each recording — the church, the artist, a label,
  or a publisher.

### How the app navigates this
- Every song row in `public.songs` supports `copyright_holder`,
  `license_type`, `license_url`, and `rights_clearance_date` so you can
  document the legal basis for hosting each track.
- Admin song creation (`app/api/admin/songs/route.ts`) stores these fields, and
  the single-song PATCH accepts them for later correction.
- Song detail surfaces attribution so listeners can see who holds rights.
- The public songs endpoint (`app/api/data/[table]/route.ts`) returns only rows
  with `status = 'approved'`.

### Still to implement / confirm
- Obtain written permission from rights holders (church leadership, artists,
  songwriters) before uploading any track.
- Review whether your existing church licenses (CCLI, OneLicense, etc.)
  extend to app-based streaming of recordings.
- Confirm public-domain status for any hymns you treat as license-free —
  arrangements and recordings of public-domain works may still be
  copyrighted.
- Decide whether uploads should default to `pending` rather than `approved`
  (see section 7).

---

## 2. Artist, songwriter & musician consent

### Concern
Even when the church owns a recording, the individuals who performed or wrote
the music may have separate rights (moral rights, likeness, performance
consent).

### How the app navigates this
- `copyright_holder` and attribution fields record who cleared each track.
- Admin panel provides a single place to review and update rights metadata.

### Still to implement / confirm
- Collect signed release forms from worship leaders, musicians, and
  songwriters whose work appears in the app.
- Store or link those release documents alongside each song record.

---

## 3. Platform & storage terms of service

### Concern
Audio is hosted on Cloudflare R2, authentication/data on Neon, and the app
deploys on Vercel. Each platform has its own acceptable-use policies, DMCA
processes, and limits on file types or bandwidth.

### How the app navigates this
- Audio goes directly from browser to R2 via short-lived presigned URLs
  (`POST /api/upload`); credentials never reach the client.
- R2 bucket CORS and `connect-src` in `next.config.mjs` are scoped to your
  domains (`localhost:3000` in dev, your production domain elsewhere).
- R2 audio URLs are treated as unlisted public links, not secrets.
- The legal contact is configurable with `NEXT_PUBLIC_LEGAL_EMAIL` (fallback
  `legal@luumbo.vercel.app`) and is published in the Terms, Privacy Policy,
  and footer.

### Still to implement / confirm
- Review Cloudflare R2, Neon, and Vercel acceptable-use policies for audio
  hosting and user-generated content.
- Configure R2 CORS to allow only your deployed domain(s).
- Set `NEXT_PUBLIC_LEGAL_EMAIL` in Vercel and `.env.local` to an inbox that is
  actually monitored, before launch.

---

## 4. DMCA / infringement reporting

### Concern
Rights holders may ask you to remove infringing tracks. Without a documented
takedown process, you increase legal exposure and risk platform enforcement.

### How the app navigates this
- **Reporting is live.** The shared `app/components/ReportSongDialog.jsx` (used
  by song rows and the player overflow menu) posts to
  `app/api/dmca/report/route.ts`. The dialog has a **copyright** mode that
  collects the elements of a statutory notice under 17 U.S.C. 512(c)(3): the
  copyrighted work, the allegedly infringing URL, the reporter's name, email,
  postal address, optional phone, an electronic signature, and the good-faith,
  accuracy-under-penalty-of-perjury, and authority statements. An **other
  issue** mode stays short. The route re-validates every field server-side,
  rate limits at 10/min, verifies the song exists, and writes to
  `public.dmca_reports`.
- **Admin review queue.** `/admin` has a **Legal** tab
  (`app/components/AdminLegalPanel.jsx`) that lists reports, shows the full
  notice, lets an admin set `open` / `reviewed` / `resolved` / `dismissed`, and
  store an internal resolution note. The API is
  `app/api/admin/dmca/route.ts`.
- **Effective takedowns.** "Take down" disables the track immediately by
  setting `public.songs.status = 'rejected'` (so public listings and share
  links stop serving it), writes a `public.takedown_log` row, resolves the
  report, and writes an admin audit event. Deleting the row and R2 object stays
  a separate admin action.
- **Reporter communication.** The queue offers a pre-filled `mailto:` reply and
  records `reply_sent_at`. The template explains the outcome and the
  counter-notice path. Sending is still manual (no transactional email
  provider).
- **Audit trail.** `public.takedown_log` records each takedown (song id, title,
  actor, reason, timestamp) and survives song deletion because `song_id` has no
  foreign key. The Legal tab reads it and exports CSV via
  `app/api/admin/takedown-log/route.ts`. Song deletion also writes an entry.
- The report dialog links to the notice requirements in `/terms#copyright`,
  which lists the statutory elements, counter-notice process, and
  repeat-infringer policy.
- The DMCA contact is published in the Terms, Privacy Policy, and footer via
  `NEXT_PUBLIC_LEGAL_EMAIL`.

### Still to implement / confirm
- **Register a DMCA agent** with the U.S. Copyright Office and publish the
  registration details; the safe-harbour in 512(c) depends on it.
- Monitor the legal inbox. The app records and queues notices, but it does not
  prove a human read them.
- Track repeat infringers and enforce the suspension/termination policy the
  Terms describe. The queue and takedown log give you the evidence; the policy
  decision is still manual.
- Decide who sends reporter replies and counter-notice acknowledgements. A
  transactional email provider would make this automatic.
- The current database has `lib/migration-legal.sql` and
  `lib/migration-legal-v2.sql` applied. Run both files on any other
  environment; they use `gen_random_uuid()` and no RLS, which matches the rest
  of the schema (the app reaches Postgres only through server routes using the
  owner role).

---

## 5. Privacy & data protection

### Concern
You collect email addresses, names, listening history, saved songs, and
session data through Neon Auth. If you have users in the EU/UK, GDPR applies;
in California, CCPA applies. You also load Vercel Analytics and Speed
Insights.

### How the app navigates this
- `public.auth_events` retains auth audit events for 90 days and purges
  opportunistically — passwords and raw tokens are never logged.
- Client-side errors are stored in `public.app_errors` for 90 days; no raw
  tokens are recorded.
- Signed-in users can delete their account from `/account`; deletion cascades
  through profiles, saved songs, playlists, sessions, and listening history.
  Security audit rows that recorded the deletion may be kept for up to 90
  days, and the Privacy Policy discloses that.
- `public.auth_events.user_id` has no foreign key so deleted accounts leave a
  minimal audit row without exposing personal data.
- The **Privacy Policy** and **Terms of Service** are published at `/privacy`
  and `/terms`, with effective and last-updated dates from `lib/legal.js`.
- Registration requires both consent checkboxes plus an age attestation, and
  `app/api/auth/register/route.ts` stores `tos_accepted_at`,
  `privacy_accepted_at`, `terms_version`, `privacy_version`, and
  `age_attested_at` on the Neon Auth user. It also appends rows to
  `public.consent_log`.
- `public.consent_log` is an append-only record of Terms, Privacy, age, and
  analytics choices (user, kind, granted, policy version, IP, user agent,
  timestamp). Analytics choices are posted by `lib/analyticsConsent.js` to
  `app/api/consent/route.ts`.
- Signed-in users who accepted an older policy version see
  `app/components/PolicyConsentBanner.jsx` until they accept the current one;
  acceptance is recorded by `app/api/auth/accept-policies/route.ts`.
- Signed-in users can download their data from `/account` or
  `GET /api/account/export`. The JSON includes the account, sessions, saved
  songs, playlists, listening history, reports filed under their email, and
  consent records — never passwords or session tokens.
- Vercel Analytics and Speed Insights mount only after the listener accepts
  the consent banner (`app/components/AnalyticsConsentBanner.jsx`). The choice
  can be reversed in **Settings → Privacy & consent**
  (`app/components/AnalyticsConsentControl.jsx`), and the shared store lives in
  `lib/analyticsConsent.js`.
- Signing out clears the local download list, playback/recent state, and the
  offline audio cache so a shared device does not retain account data.
- Reset App Data clears every `lumbo_`/`lumbo-` localStorage key plus caches.
- `/accessibility` describes keyboard access, screen-reader semantics, media
  alternatives, contrast, reduced motion, and how to report a barrier.

### Still to implement / confirm
- Set and monitor `NEXT_PUBLIC_LEGAL_EMAIL`; the fallback address is only a
  placeholder for the production domain.
- If you have EU/UK users, confirm a lawful basis for processing, consider a
  Data Processing Agreement with subprocessors, and check whether an EU/UK
  representative is required.
- Confirm retention periods for `public.consent_log`, `public.dmca_reports`,
  and `public.takedown_log`, and document them in the Privacy Policy.
- Keep the provider list in the Privacy Policy current if Neon, Cloudflare, or
  Vercel change their role or subprocessors.

---

## 6. Streaming vs. downloading

### Concern
Making audio easy to download can facilitate unauthorized redistribution of
copyrighted music.

### How the app navigates this
- Audio streams through HTML5 `<audio>`; playback URLs are resolved
  client-side through `getAudioPublicUrl`.
- An **offline download** feature exists: `lib/downloadManager.js` caches the
  audio in the browser's Cache Storage (`lumbo-audio-cache-v1`) and keeps a
  per-device list in `lumbo_downloaded_songs`.
- Downloads are playable only inside the app, are not exportable files, and
  are removed when the listener deletes them, when the audio is replaced, on
  sign-out, and on Reset App Data. A track an admin removes from the catalogue
  is not automatically purged from a device that already downloaded it.
- The Terms disclose the download feature and prohibit extracting,
  redistributing, or commercially using offline copies.
- **Per-track download permission.** `public.songs.download_allowed` (default
  `true`) hides the download action in the player menu and in
  `lib/downloadManager.js` when a licence is streaming-only. Admins set it in
  `app/components/EditModal.jsx`.
- R2 presigned URLs for upload are short-lived (PUT); playback URLs are not
  offered as permanent download links in page source beyond what the player
  requires.

### Still to implement / confirm
- Confirm that your licences cover **offline/download copies**, not just
  streaming; mechanical or download licences may be required separately.
- Remember that browser storage can be evicted by the OS or browser, so
  downloads are a convenience, not a guaranteed archive.
- Consider a launch-time revocation check if your licences require a taken-down
  track to stop playing on devices that already cached it.

---

## 7. Pre-publication moderation

### Concern
If anyone can upload a song, unvetted copyrighted or inappropriate content can
go live instantly.

### How the app navigates this
- Uploads require an admin session (`getAdminFromRequest` in
  `app/api/upload/route.ts` and `app/api/admin/songs/route.ts`).
- Song creation verifies the audio object actually exists in R2 before
  inserting the row.
- `public.songs.status` supports `pending` / `approved` / `rejected`, and the
  public songs endpoint returns only approved rows.
- **New uploads default to `pending`.** `app/api/admin/songs/route.ts` inserts
  `pending` unless an explicit valid status is supplied, and the upload screen
  tells the uploader the track goes public after review.
- The admin **Edit Track** dialog (`app/components/EditModal.jsx`) exposes
  status, rights holder, licence type/URL, clearance date, download permission,
  and region restriction. Approving a track with no rights metadata requires a
  self-owned / public-domain attestation checkbox.
- `app/share/[id]/page.js` filters `status = 'approved'`, so a pending or
  rejected track is not reachable through a direct share link.

### Still to implement / confirm
- Bulk update (`app/api/admin/songs/bulk-update/route.ts`) does not accept
  `status`; extend it if you want bulk moderation.
- Decide who reviews the pending queue and how quickly. The UI exists; the
  staffing is operational.
- Consider requiring the rights attestation server-side as well, not only in
  the edit dialog.

---

## 8. Geographic licensing restrictions

### Concern
A license may cover streaming in one country but not another.

### How the app navigates this
- `public.songs.region_restricted` (default `false`) and
  `public.songs.allowed_countries` (ISO-3166 alpha-2 allowlist) are editable in
  the admin Edit Track dialog and accepted by the song APIs.
- `lib/geo.js` reads `x-vercel-ip-country` or `cf-ipcountry`. The public songs
  endpoint filters restricted rows by the request country, and the share page
  shows "Not available in your region" instead of the player.
- When no geo header is present (local development, self-hosted deployment
  without a geo proxy), the check **fails open** rather than hiding the whole
  library. A restricted track with an empty allowlist is denied once a country
  is known.

### Still to implement / confirm
- Configure a geo header in production (Vercel supplies
  `x-vercel-ip-country` automatically) before relying on territory licences.
- Region checks use IP geolocation, which is approximate and can be bypassed
  with a VPN. Treat them as a good-faith control, not DRM.
- Confirm that your licences permit IP-based enforcement and that the
  allowlist matches each licence's territory.

---

## 9. Announcements & links

### Concern
Admin-posted announcements can link outward; malicious or infringing links
create liability.

### How the app navigates this
- `normalizeNotificationUrl` in `lib/notifications.ts` rejects
  `javascript:`, `data:`, `http:`, and protocol-relative `//host` URLs. Only
  in-app paths (`/songs`) and `https://` links are accepted.
- Announcement links are limited to one per post and validated before insert.
- Deleting a song retracts its release announcement, so no tile points at a
  removed track.

---

## Recommended next steps (non-technical)

1. **Ask church leadership** about existing licenses (CCLI, OneLicense, etc.)
   and whether they cover app-based streaming **and offline downloads** of
   recordings.
2. **Get written releases** from all performers, songwriters, and rights
   holders for every track you host.
3. **Have an attorney review** the published Terms and Privacy Policy in
   `app/terms` and `app/privacy` before launch; they are drafted but not
   legal advice.
4. **Set `NEXT_PUBLIC_LEGAL_EMAIL`** to a monitored inbox and test that a
   message actually arrives.
5. **Register a DMCA agent** with the U.S. Copyright Office, publish the
   registration details, and decide who monitors the Legal tab and replies to
   reporters.
6. **Staff the pending-review queue** and decide how quickly uploads are
   approved. New uploads are already `pending` by default.
7. **Review R2 / Neon / Vercel terms** and any required data processing
   agreements.
8. **Have an attorney clear the app** before any public release or marketing,
   including the Terms, Privacy Policy, accessibility statement, DMCA process,
   consent log, and licensing metadata.

## 10. Implementation status

Implemented in code (database migration in `lib/migration-legal-v2.sql`):

| Area | Status |
| --- | --- |
| Statutory copyright notice form | Implemented (`ReportSongDialog.jsx`) |
| Admin DMCA queue with status/notes | Implemented (`/admin` → Legal) |
| Effective takedown + audit log + CSV | Implemented (`takedown_log`, `AdminLegalPanel`) |
| Reporter reply template | Implemented as a manual `mailto:` with `reply_sent_at` |
| Rights/licence metadata and approval attestation | Implemented (`EditModal.jsx`) |
| Pending-by-default uploads | Implemented |
| Per-track download permission | Implemented (`download_allowed`) |
| Region allowlists | Implemented (`lib/geo.js`); fails open without a geo header |
| Self-service data export | Implemented (`/api/account/export`, `/account`) |
| Policy re-consent | Implemented (`PolicyConsentBanner`, `/api/auth/accept-policies`) |
| Server-side consent log | Implemented (`consent_log`, `/api/consent`) |
| Age attestation at sign-up | Implemented (`age_attested_at`) |
| Accessibility statement | Implemented (`/accessibility`) |

Operational items that remain outside the code: a registered DMCA agent, a
monitored legal inbox, signed releases/licences, DPAs, and attorney review.
