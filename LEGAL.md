# Legal Considerations — Luumbo

**Disclaimer:** I am not an attorney. This document is an internal reference,
not legal advice. Have a qualified lawyer review your Terms of Service, Privacy
Policy, and licensing arrangements before launching publicly.

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
- Admin song creation (`app/api/admin/songs/route.ts`) stores these fields.
- Song detail surfaces attribution so listeners can see who holds rights.

### Still to implement / confirm
- Obtain written permission from rights holders (church leadership, artists,
  songwriters) before uploading any track.
- Review whether your existing church licenses (CCLI, OneLicense, etc.)
  extend to app-based streaming of recordings.
- Confirm public-domain status for any hymns you treat as license-free —
  arrangements and recordings of public-domain works may still be
  copyrighted.

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

### Still to implement / confirm
- Review Cloudflare R2, Neon, and Vercel acceptable-use policies for audio
  hosting and user-generated content.
- Configure R2 CORS to allow only your deployed domain(s).
- Keep a DMCA/takedown contact ready in case a platform notifies you of
  infringing content.

---

## 4. DMCA / infringement reporting

### Concern
Rights holders may ask you to remove infringing tracks. Without a documented
takedown process, you increase legal exposure and risk platform enforcement.

### How the app navigates this
- `retractSongAnnouncements()` in `lib/announcement.ts` removes release
  announcements when a song is deleted, so dead tiles don't point at removed
  content.
- Song deletion (`app/api/admin/songs/[id]/route.ts`) removes the R2 object,
  the `public.songs` row, and its announcement.

### Still to implement / confirm
- Add a **"Report this song"** button on `SongItem.jsx` that writes to a
  `public.dmca_reports` table (song_id, reporter, reason, status).
- Build an admin review queue on `/admin` to action reports (remove,
  restrict, or dismiss).
- Publish a DMCA contact email and takedown procedure in your Terms of
  Service and footer.
- Log every takedown in a `public.takedown_log` table (actor, target, reason,
  timestamp) for your own audit trail.

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
- `public.auth_events.user_id` has no foreign key so deleted accounts leave a
  minimal audit row without exposing personal data.

### Still to implement / confirm
- Publish a **Privacy Policy** describing what you collect, why, how long you
  keep it, and who it is shared with (Neon, Cloudflare, Vercel).
- Publish **Terms of Service** covering acceptable use, content ownership, and
  liability limits.
- Require users to accept ToS/Privacy Policy at registration and store
  `tos_accepted_at` / `privacy_accepted_at`.
- Add a cookie/analytics consent banner so Vercel Analytics loads only after
  consent.
- If you have EU/UK users, confirm a lawful basis for processing and consider
  a Data Processing Agreement with your subprocessors.

---

## 6. Streaming vs. downloading

### Concern
Making audio easy to download can facilitate unauthorized redistribution of
copyrighted music.

### How the app navigates this
- Audio is streamed via HTML5 `<audio>` with `playsInline`; no "Download MP3"
  button exists.
- R2 presigned URLs are short-lived (PUT) and playback URLs are resolved
  client-side through `getAudioPublicUrl`, not exposed as permanent download
  links in page source beyond what the player requires.

### Still to implement / confirm
- Do not add a download feature without legal review.
- Consider range-request support and secure URL expiration through your R2
  setup.

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

### Still to implement / confirm
- Add a `status` column (`pending` / `approved` / `rejected`) to
  `public.songs`; only `approved` songs are returned by `GET /api/data/songs`
  and rendered in `SongList`.
- Build an admin moderation queue on `/admin` to approve or reject pending
  uploads before listeners can play them.

---

## 8. Geographic licensing restrictions

### Concern
A license may cover streaming in one country but not another.

### How the app navigates this
- The schema supports adding a `region_restricted` flag per song.
- `getAudioPublicUrl` and the player can be gated on the user's region before
  revealing playback URLs.

### Still to implement / confirm
- Add region detection and per-song territory blocks if your licenses are
  geography-limited.

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

---

## Recommended next steps (non-technical)

1. **Ask church leadership** about existing licenses (CCLI, OneLicense, etc.)
   and whether they cover app-based streaming of recordings.
2. **Get written releases** from all performers, songwriters, and rights
   holders for every track you host.
3. **Draft Terms of Service and a Privacy Policy** with an attorney.
4. **Set up a DMCA contact** and takedown procedure before launch.
5. **Review R2 / Neon / Vercel terms** for audio hosting and UGC.
6. **Have an attorney clear the app** before any public release or marketing.
