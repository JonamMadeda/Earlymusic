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
- **Reporting is live.** "Report this song" in `app/components/SongItem.jsx`
  posts to `app/api/dmca/report/route.ts`, which writes to
  `public.dmca_reports` (`song_id`, `reporter_name`, `reporter_email`,
  `reason`, `status`). The route is rate limited (10/min), verifies the song
  exists, caps the reason at 1,000 characters, trims/caps reporter details,
  and rejects a malformed reporter email.
- Reports can be filed anonymously; name and email are optional, and the form
  says the email is used for a reply.
- The report dialog links to the notice requirements in
  `/terms#copyright`, which lists the statutory elements, counter-notice
  process, and repeat-infringer policy.
- `public.takedown_log` records each admin deletion (song id, title, actor,
  reason, timestamp). It is written by the song-delete route
  (`app/api/admin/songs/[id]/route.ts`); there is no in-app reader yet.
- Song deletion removes the R2 object and the `public.songs` row, writes a
  `public.takedown_log` entry, and retracts the release announcement.
- The DMCA contact is published in the Terms, Privacy Policy, and footer via
  `NEXT_PUBLIC_LEGAL_EMAIL`.

### Still to implement / confirm
- **Admin review queue.** Reports are stored but `/admin` has no tab that
  reads or actions them, so `status` stays `open`. Until that exists, review
  `public.dmca_reports` directly in SQL and update rows by hand.
- Acknowledge reports to the reporter and forward valid counter-notices to the
  original complainant; neither is automated today.
- Track repeat infringers and enforce the suspension/termination policy the
  Terms describe.
- Add a UI for `public.takedown_log` if you want an auditable in-app history.
- The current database has `lib/migration-legal.sql` applied. Run the same
  file on any other environment; it uses `gen_random_uuid()` and no RLS, which
  matches the rest of the schema (the app reaches Postgres only through server
  routes using the owner role).

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
- Registration requires both consent checkboxes, and
  `app/api/auth/register/route.ts` stores `tos_accepted_at` and
  `privacy_accepted_at` on the Neon Auth user.
- Vercel Analytics and Speed Insights mount only after the listener accepts
  the consent banner (`app/components/AnalyticsConsentBanner.jsx`). The choice
  can be reversed in **Settings → Privacy & consent**
  (`app/components/AnalyticsConsentControl.jsx`), and the shared store lives in
  `lib/analyticsConsent.js`.
- Signing out clears the local download list, playback/recent state, and the
  offline audio cache so a shared device does not retain account data.
- Reset App Data clears every `lumbo_`/`lumbo-` localStorage key plus caches.

### Still to implement / confirm
- Set and monitor `NEXT_PUBLIC_LEGAL_EMAIL`; the fallback address is only a
  placeholder for the production domain.
- If you have EU/UK users, confirm a lawful basis for processing, consider a
  Data Processing Agreement with subprocessors, and check whether an EU/UK
  representative is required.
- Consider a self-service data export. Today the Privacy Policy says to
  contact the legal address for a copy.
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
- R2 presigned URLs for upload are short-lived (PUT); playback URLs are not
  offered as permanent download links in page source beyond what the player
  requires.

### Still to implement / confirm
- Confirm that your licences cover **offline/download copies**, not just
  streaming; mechanical or download licences may be required separately.
- Consider a per-track download permission flag and hide the download control
  for tracks that are not cleared for offline use.
- Remember that browser storage can be evicted by the OS or browser, so
  downloads are a convenience, not a guaranteed archive.

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
- The single-song PATCH accepts `status`, so moderation can be scripted or
  added to the UI without a schema change.

### Still to implement / confirm
- There is no admin UI for `status`, and new uploads default to `approved`.
  Add a moderation control/queue on `/admin`, and consider making uploads
  `pending` by default.
- `app/share/[id]/page.js` fetches a song by id without checking `status`, so
  a pending or rejected track is still reachable through a direct
  `/share/<id>` link. Add a status filter there.
- Bulk update (`app/api/admin/songs/bulk-update/route.ts`) does not accept
  `status`; extend it if you want bulk moderation.

---

## 8. Geographic licensing restrictions

### Concern
A license may cover streaming in one country but not another.

### How the app navigates this
- `public.songs.region_restricted` exists (default `false`) and the
  single-song PATCH accepts it.

### Still to implement / confirm
- Nothing enforces `region_restricted` yet: playback and the share page do not
  check the listener's region. Add region detection and per-song territory
  blocks before relying on geography-limited licences.

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
5. **Build the DMCA admin queue** and a repeat-infringer record, and decide
   who replies to reporters.
6. **Decide the moderation default** (`pending` vs `approved`) and add the
   missing `status` check to the share page.
7. **Review R2 / Neon / Vercel terms** and any required data processing
   agreements.
8. **Have an attorney clear the app** before any public release or marketing.
