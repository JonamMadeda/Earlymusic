# Luumbo UI/UX Improvement Audit

## Status-tracking instructions

Every recommendation in this document must carry exactly one status:

- **[Pending]** — the recommendation has not been fully implemented and verified.
- **[Implemented]** — the recommendation has been fully implemented and verified.

When a recommendation is completed, change its tag from **[Pending]** to **[Implemented]**. Do not delete completed recommendations. If work is partial or unverified, leave it tagged **[Pending]**.

All recommendations are initially tagged **[Pending]**. The implementation phases at the end of this document define the delivery order; a phase is complete only when every recommendation mapped to it is **[Implemented]** and the phase exit criteria pass.

## Audit overview

Luumbo has a strong functional foundation: persistent playback, useful empty states, offline support, and thoughtful keyboard behavior. The largest opportunities are to reduce density, clarify primary actions, and standardize interaction patterns.

This is a code-based UX audit; a reliable screenshot review was not available when it was written.

**Priorities:**

- **P0** — usability, accessibility, or data-loss concerns.
- **P1** — high-impact workflow and information-architecture improvements.
- **P2** — visual refinement and polish.

---

## 1. Global layout and design system

### P0 — Improve legibility and touch usability

- **[Pending]** Establish a clearer type scale: **20–24px page titles, 16–18px section titles, 14–16px body text, and 12–14px metadata**. Current 8–11px labels and metadata are overused.
- **[Pending]** Make interactive targets at least **44×44px on touch devices**, especially alphabet jumps, dismiss buttons, icon actions, and filter chips.
- **[Pending]** Keep hover-revealed actions visible on `focus-within`, not only `group-hover`.

### P1 — Standardize the visual language

- **[Pending]** Use one consistent page container, spacing rhythm, card radius, and shadow level. Adjacent pages currently mix `rounded-xl`, `rounded-2xl`, `rounded-3xl`, multiple background treatments, and several button silhouettes.
- **[Pending]** Standardize buttons into four patterns: **primary, secondary, tertiary, and destructive**. Avoid using the same dark accent for primary actions, metadata badges, categories, and statuses.
- **[Pending]** Keep the existing navy brand color, but consider a restrained warm-gold accent for “New,” spotlight content, and worship-oriented highlights—not for additional competing CTAs. The current accent is defined in [app/globals.css:3](app/globals.css#L3).

### P1 — Simplify the application shell

- **[Pending]** Move legal/footer content into the primary scrolling experience or reduce it to a compact legal strip. The current full-height app shell plus external footer creates competing scroll contexts in [app/layout.js:80](app/layout.js#L80).
- **[Pending]** Use only one `<main>` landmark per page; the layout and individual pages currently both render one.
- **[Pending]** Remove infrastructure details such as “Auth & data on Neon” from the customer-facing footer. Keep Terms, Privacy, Accessibility, Privacy Choices, and Contact.

---

## 2. Home

### P1 — Establish a stronger content hierarchy

- **[Pending]** For returning listeners, lead with **Continue Listening** and **Fresh Releases**. For new listeners, lead with **Featured** or **Fresh Releases**.
- **[Pending]** Merge or clearly differentiate **Featured** and **Keep Exploring**. Both currently use shuffled catalog selections, so they feel repetitive rather than editorially distinct.
- **[Pending]** Replace the dominant **Shuffle All** CTA with **Resume Listening** when playback history exists; keep Shuffle as the secondary action. See the current section order in [app/page.js:831](app/page.js#L831).

### P1 — Put filters beside the content they control

- **[Pending]** Move the category pills directly above **Curated for You**. They currently sit near the top, modify a much lower section, and then forcibly scroll the user to it.
- **[Pending]** Preserve the selected filter in the URL so Back/Forward and shared links retain context. Current behavior is in [app/page.js:728](app/page.js#L728).

### P0 — Control automatically changing content

- **[Pending]** Pause the rotating scripture when the user interacts with it, respect reduced-motion preferences, and provide previous/next controls. It currently changes every ten seconds without a pause mechanism in [app/page.js:470](app/page.js#L470).

---

## 3. Songs

### P0 — Simplify the mobile browsing controls

- **[Pending]** Replace the tiny alphabet rail on phones with a larger **A–Z jump button opening a bottom sheet**, or substantially increase its targets. Current buttons are approximately 16–18px high in [app/songs/page.js:1057](app/songs/page.js#L1057).
- **[Pending]** Reduce the number of simultaneously sticky elements. The search toolbar, group labels, and alphabet rail compete for limited vertical space.

### P1 — Make sorting explicit

- **[Pending]** Replace the three-state cycling sort button with a standard menu: **Title, Artist, Date Added**, plus a separate ascending/descending control.
- **[Pending]** On mobile, show the current selection rather than only an icon. The current control is in [app/songs/page.js:864](app/songs/page.js#L864).

### P1 — Improve song actions

- **[Pending]** Use a **bottom sheet on mobile** and an anchored menu on desktop for song actions.
- **[Pending]** Add success feedback such as “Added to Sunday Worship” with **View playlist** and **Undo**. Adding to a playlist currently provides little visible confirmation.
- **[Pending]** Preserve search, filters, sorting, and scroll position in the URL.

---

## 4. Shared song rows and menus

The Songs and Library experiences currently implement separate versions and should use one shared design.

### P0 — Separate playback from secondary actions

- **[Pending]** Make the artwork/title area the playback target and keep More, Save, Download, and Playlist controls outside that target. The current row-wide `role="button"` wraps additional interactive controls in [app/components/SongItem.jsx:202](app/components/SongItem.jsx#L202).
- **[Pending]** Consolidate `SongItem` and the Songs-page `SongRow` into one design with consistent metadata, menus, focus behavior, download state, and feedback.
- **[Pending]** Use a proper menu/dialog pattern with Escape handling, focus placement, focus return, and mobile-safe positioning.

---

## 5. Global Search

### P0 — Complete dialog keyboard behavior

- **[Pending]** Trap focus inside the search dialog and return it to the search trigger when closed.
- **[Pending]** Add Arrow Up/Down navigation and Enter selection for results while preserving Cmd/Ctrl+K support and visible focus states.

### P1 — Make empty and no-result states useful

- **[Pending]** Show **Recent Searches**, **Recently Played**, or **Suggested Songs** before typing instead of a mostly empty panel.
- **[Pending]** Add **See all results** linking to the Songs page with the query preserved; the modal currently caps results at eight in [app/components/GlobalSearchModal.jsx:29](app/components/GlobalSearchModal.jsx#L29).
- **[Pending]** On no results, offer **Clear search** and **Browse all songs**.

---

## 6. Player

### P1 — Simplify the mobile mini-player

- **[Pending]** Keep **Play/Pause** and **Next** as the persistent controls. Move Previous and Save into the expanded player if the row becomes crowded.
- **[Pending]** Preserve the large title/artwork tap target for opening the full player. The current mobile row contains Previous, Play, Next, and Save alongside metadata in [app/components/Player.jsx:1132](app/components/Player.jsx#L1132).

### P1 — Use conventional Previous behavior

- **[Pending]** Replace the double-press-within-two-seconds model. A familiar pattern is: **restart when more than three seconds have elapsed; otherwise go to the previous track**.
- **[Pending]** If the existing behavior remains, explain it visibly because it is otherwise difficult to discover. Current logic is in [app/components/Player.jsx:528](app/components/Player.jsx#L528).

### P2 — Improve the expanded desktop layout

- **[Pending]** Present Queue as a side panel rather than replacing the artwork.
- **[Pending]** Add a compact keyboard-shortcuts help popover for Space/K, arrows, M, and Q.

---

## 7. Library

### P1 — Make tabs navigable and action-oriented

- **[Pending]** Reflect the active tab in the URL whenever it changes, and respond to URL changes after mount. The current tab is initialized from `?tab=` only once in [app/library/page.js:41](app/library/page.js#L41).
- **[Pending]** Add **Play All** and **Shuffle** to Saved Songs, matching the existing Top 10 action.
- **[Pending]** Add search within Saved Songs once the collection becomes substantial.

### P1 — Make playlist cards informative

- **[Pending]** Show track count, a small artwork collage, and optionally last-updated date.
- **[Pending]** Replace the hover-only trash icon with an overflow menu containing **Open, Rename, Delete**.
- **[Pending]** Make account stats clickable or remove them when they merely repeat Quick Links.

### P2 — Improve the signed-out preview

- **[Pending]** Show the benefits of Saved, Playlists, Top, and Downloads around the sign-in CTA instead of presenting only a large empty state.

---

## 8. Playlist detail

### P1 — Add the missing primary listening actions

- **[Pending]** Put **Play** and **Shuffle** beside the playlist title. Add Songs should be secondary; Delete should move into an overflow menu.
- **[Pending]** Add track count and total duration. The current header offers only Add Songs and Delete in [app/playlists/[id]/page.js:192](app/playlists/%5Bid%5D/page.js#L192).

### P1 — Turn adding songs into a focused flow

- **[Pending]** Show recently played, saved songs, or suggested tracks before the user types. Currently no available songs appear until a query exists.
- **[Pending]** Keep selected songs visible as chips and place **Add selected** in a sticky footer.
- **[Pending]** Add an **Add Songs** button inside the empty-state card itself.

### P0 — Make removal recoverable

- **[Pending]** Replace immediate track removal with an **Undo toast**. Reserve confirmation dialogs for deleting the entire playlist.

---

## 9. Standalone Playlists and Downloads

### P1 — Consolidate duplicate destinations

- **[Pending]** Keep `/library?tab=playlists` and `/library?tab=downloads` as the canonical experiences.
- **[Pending]** Redirect the standalone pages rather than maintaining two visually different implementations of the same features. Downloads alone duplicates storage, playback, and removal UI in [app/downloads/page.js:57](app/downloads/page.js#L57).
- **[Pending]** Use consolidation to fix inconsistent navigation highlighting and reduce future design drift.

---

## 10. Notifications

### P1 — Clarify read behavior

- **[Pending]** Align the badge, “New” markers, and **Mark all read** behavior. Opening the page currently clears the shared badge while retaining unread highlights, making the later button’s effect unclear.
- **[Pending]** Either mark items read when viewed or rename the action to **Clear new markers**. See [app/notifications/page.js:105](app/notifications/page.js#L105).

### P0 — Improve dismissal accessibility

- **[Pending]** Increase the dismiss target to 44px and expose it on keyboard focus.
- **[Pending]** Add a **Recently dismissed** or **Restore dismissed announcements** view, noting that dismissal is device-specific.

### P2 — Use meaningful CTA labels

- **[Pending]** Replace generic **Open** labels with action-specific text such as **Listen to the release**, **View update details**, or **Read announcement**.

---

## 11. Authentication and password recovery

### P1 — Reduce sign-up friction

- **[Pending]** Place **Forgot password?** beside the password label rather than below the submit button.
- **[Pending]** Stack first/last name fields on very narrow screens.
- **[Pending]** If legally acceptable, combine Terms and Privacy acceptance into one clearly linked checkbox while keeping age attestation separate. The current three-checkbox sequence adds friction in [app/auth/page.jsx:607](app/auth/page.jsx#L607).

### P0 — Bring validation closer to fields

- **[Pending]** Show password mismatch and invalid input messages directly beneath the relevant field, then focus the first invalid field on submission.
- **[Pending]** Preserve the existing password visibility controls and autocomplete attributes during authentication UI changes.

### P1 — Improve verification recovery

- **[Pending]** Add a resend countdown and clear expired-code guidance.
- **[Pending]** After verification, retain the email and place focus in the password field.

---

## 12. Account

### P0 — Correct save feedback

- **[Pending]** Display failed saves in red with an explanatory message; currently both success and failure use the same green styling in [app/account/page.js:307](app/account/page.js#L307).
- **[Pending]** Disable Save until the profile differs from its saved state.

### P1 — Break up the long page

- **[Pending]** Group content into **Profile**, **Security**, and **Data & Privacy**, using tabs or anchored subsection navigation.
- **[Pending]** Remove or relocate Quick Links that duplicate the primary navigation.
- **[Pending]** Keep only account deletion in a red danger zone; normal sign-out should use neutral styling.

### P1 — Use consistent confirmation patterns

- **[Pending]** Replace the four-second “Tap to confirm” sign-out-everywhere interaction with the shared confirmation dialog.
- **[Pending]** Allow the email and joined-date metadata to wrap cleanly on small screens.

---

## 13. Settings

### P0 — Protect destructive operations

- **[Pending]** Add confirmation before **Clear Downloads** and **Reset All Data**, explicitly listing what will be removed and what will remain.
- **[Pending]** Consider Undo for clearing downloads; Reset All Data should require the stronger shared destructive-action dialog. These actions currently run directly in [app/settings/page.js:42](app/settings/page.js#L42).

### P1 — Remove duplicated management surfaces

- **[Pending]** Keep download management in Library and make Settings link to it.
- **[Pending]** Label storage as **Approximate browser storage for Luumbo**, rather than implying it measures the entire device.

### P1 — Make updates less abrupt

- **[Pending]** Rename **Refresh Now** to **Check for updates** and show “You’re up to date” or “Update ready” before reloading.

---

## 14. Shared song page

### P1 — Clarify playback state and actions

- **[Pending]** If the shared song is selected but paused, show **Ready in the player** rather than **Now playing**. Current state depends only on whether it is the active song in [app/share/[id]/ShareClient.jsx:44](app/share/%5Bid%5D/ShareClient.jsx#L44).
- **[Pending]** Keep **Play this song** primary and **Share** secondary. Move Copy Link into the share sheet unless native sharing is unavailable.
- **[Pending]** Make **Browse more worship music** the main post-listening discovery action.

### P2 — Improve link presentation

- **[Pending]** Use song-specific generated artwork for social previews instead of the generic Luumbo icon.

---

## 15. Admin upload

### P1 — Use a three-step publishing flow

- **[Pending]** Restructure publishing into: **1. Select and name files; 2. Enter shared artist/category/compilation metadata; 3. Review and publish.** This should make the “applies to every track” relationship clearer than the current dense two-column form in [app/upload/page.tsx:270](app/upload/page.tsx#L270).

### P0 — Improve status and destructive feedback

- **[Pending]** Change the dropzone copy from “Drop MP3s” to **Drop audio files** to match accepted formats, and add a visible keyboard-focus state.
- **[Pending]** Show **Uploaded · Pending review** rather than presenting pending tracks with the same green success treatment as completed publication.
- **[Pending]** Confirm **Start over** when files or metadata would be discarded.

### P1 — Improve batch control

- **[Pending]** Add per-file progress where supported, plus **Retry failed** without re-uploading successful tracks.
- **[Pending]** Avoid silently applying the prefilled artist to every batch; require confirmation or make the default especially prominent.

---

## 16. Admin dashboard

### P1 — Simplify navigation and terminology

- **[Pending]** Use **Admin** consistently instead of alternating between Admin and Vault.
- **[Pending]** Group seven horizontal tabs into clearer areas such as **Catalog**, **Publishing**, **Insights**, and **System**, with secondary navigation where needed. Current tabs are in [app/admin/page.js:629](app/admin/page.js#L629).

### P0 — Make moderation status visible

- **[Pending]** Add **Pending, Approved, Rejected**, rights-clearance, and audio-health columns/filters. The admin list includes non-public tracks, but the row treatment emphasizes category and duration instead of review status.
- **[Pending]** Do not communicate audio health through red/amber/green dots alone; include text or icons.

### P1 — Optimize track management for mobile

- **[Pending]** Convert rows into compact cards with a single overflow menu rather than squeezing category badges and four icon actions into each row.
- **[Pending]** Add accessible names to all icon-only actions; do not rely on hover `title` attributes.
- **[Pending]** Label chart axes and provide a tabular alternative for listening/signup charts.

---

## 17. Terms, Privacy, Accessibility, and Error

### Legal pages

- **[Pending]** Preserve the short summary and table of contents during legal-page design changes.
- **[Pending]** Increase body copy to **15–16px**, constrain reading width to roughly **65–75 characters**, and reduce the heavy card treatment between every section for a more continuous reading experience. The current body treatment is in [app/components/LegalPage.jsx:156](app/components/LegalPage.jsx#L156).
- **[Pending]** Highlight the active section in the desktop table of contents.

### Accessibility page

- **[Pending]** Treat its claims about labelled controls, focus handling, and status communication as an implementation checklist. Some admin icon actions and small targets currently need alignment with those statements in [app/accessibility/page.js:39](app/accessibility/page.js#L39).

### Error page

- **[Pending]** Keep **Try again** primary and add **Go home** plus **Contact support** as secondary recovery options. Preserve the reassuring playback message in [app/error.js:8](app/error.js#L8).

---

## Implementation phases

The 98 audit recommendations are mapped once across eight phases. The order is dependency-driven: shared visual and interaction foundations land first, then core listening journeys, then account/admin surfaces, then public-facing polish and final verification. Each feature phase carries its own P0 items so safety work is not deferred behind unrelated polish.

Building a shared primitive does not by itself complete a recommendation. A recommendation becomes **[Implemented]** only after every affected surface adopts it and the behavior is verified.

### Coverage map

| Phase | Focus | Audit coverage | Items | Depends on |
| --- | --- | --- | ---: | --- |
| 1 | Foundation and destructive-action safety | §1 P0; §1 P1 visual language; §12 P0; §13 P0 | 10 | — |
| 2 | Shell and shared interaction patterns | §1 P1 shell; §4 P0; §3 song-action menu/feedback items; §5 P0 | 10 | 1 |
| 3 | Home and Songs browsing | §2; §3 mobile controls, sorting, URL state | 11 | 1, 2 |
| 4 | Player and Global Search | §6; §5 P1 | 9 | 2, 3 |
| 5 | Library, playlists, and downloads | §7; §8; §9 | 16 | 2, 3 |
| 6 | Authentication, Account, and Settings | §11; §12 P1; §13 P1 | 15 | 1, 2 |
| 7 | Admin publishing and moderation | §15; §16 | 13 | 1, 2 |
| 8 | Notifications, shared songs, legal, and error recovery | §10; §14; §17 | 14 | 1, 2, 4; final audit after 7 |

### Phase 1 — Foundation and destructive-action safety

**Goal:** establish the shared design language and prevent accidental data loss before redesigning individual journeys.

**Scope**

- §1 P0: type scale, 44px touch targets, and `focus-within` visibility for hover-revealed actions.
- §1 P1 “Standardize the visual language”: page container/spacing/radius/shadow rhythm, four button patterns, and restrained navy/warm-gold usage.
- §12 P0: distinct failed-save feedback and dirty-state Save enabling.
- §13 P0: confirmation for Clear Downloads and Reset All Data, with Undo considered for downloads and the stronger dialog for reset.
- Build the shared confirmation dialog, destructive-action styling, Undo toast, and success/error status patterns needed by later phases.

**Exit criteria**

- Touched surfaces use the same type, spacing, button, and status primitives; no new one-off destructive confirmation pattern is introduced.
- Account save failure is visually and textually distinct from success; Save is disabled when the profile is unchanged.
- Clear Downloads and Reset All Data cannot run from a single accidental activation; the dialog states what is removed and what remains.
- Keyboard and touch checks pass for the new primitives at narrow and desktop widths.

### Phase 2 — Shell and shared interaction patterns

**Goal:** fix the application frame and consolidate the row, menu, sheet, and dialog behavior reused across the product.

**Scope**

- §1 P1 “Simplify the application shell”: footer/scroll ownership, one `<main>` landmark, and removal of infrastructure details from the customer footer.
- §4 P0: separate playback from secondary actions, consolidate `SongItem` and Songs-page `SongRow`, and use proper menu/dialog focus behavior.
- §3 P1 song actions: mobile bottom sheet/desktop anchored menu, and playlist-add success feedback with **View playlist** and **Undo**.
- §5 P0: search-dialog focus trap/restoration and Arrow Up/Down/Enter result navigation.

**Exit criteria**

- There is one primary scroll context and one `<main>` landmark per page; legal links remain reachable without infrastructure branding.
- Songs and Library render the same row design, with playback and secondary controls as separate targets.
- Menus and sheets close with Escape, place and return focus correctly, and remain usable on touch devices.
- Adding a song to a playlist produces visible confirmation with recovery/navigation actions.
- Global Search preserves Cmd/Ctrl+K while supporting full keyboard result selection.

### Phase 3 — Home and Songs browsing

**Goal:** make discovery and catalog browsing predictable, recoverable, and usable on phones.

**Scope**

- §2: returning/new-listener hierarchy, Featured versus Keep Exploring, Resume Listening, filter placement, URL-backed filters, and scripture rotation controls.
- §3 P0: mobile A–Z jump replacement/enlargement and reduced competing sticky elements.
- §3 P1 sorting: explicit Title/Artist/Date Added menu, separate direction control, and visible mobile selection.
- §3 P1 URL state: preserve search, filters, sorting, and scroll position.

**Exit criteria**

- Home leads with the most relevant listening action and no longer forces a scroll to reach filtered content.
- Scripture rotation can be paused/stepped and respects reduced motion.
- Songs sorting exposes the current field and direction; the alphabet jump is usable by touch and keyboard.
- Back/Forward and shared Songs URLs restore the same search, filter, sort, and scroll context.

### Phase 4 — Player and Global Search

**Goal:** make persistent playback and search feel conventional, continuous, and complete.

**Scope**

- §6: mobile mini-player control density, large open-player target, conventional Previous behavior, desktop Queue side panel, and keyboard-shortcut help.
- §5 P1: pre-query recent/suggested content, **See all results**, and useful no-result actions.

**Exit criteria**

- Mini-player controls fit narrow screens without crowding metadata; opening the full player remains easy.
- Previous restarts after three seconds and otherwise moves to the previous track, or the retained behavior is visibly explained.
- Queue no longer replaces artwork on desktop; shortcut help matches actual bindings.
- Search offers useful content before typing, a path to full results, and clear recovery when nothing matches.
- Playback survives navigation and repeated Previous/Next/Play/Pause interaction without duplicate listeners or state corruption.

### Phase 5 — Library, playlists, and downloads

**Goal:** make personal collections actionable and remove duplicate destinations.

**Scope**

- §7: reactive tab URLs, Saved Songs Play All/Shuffle/search, informative playlist cards, playlist overflow menu, account-stat cleanup, and signed-out preview.
- §8: playlist Play/Shuffle/count/duration, pre-query add-song suggestions, selected-song chips and sticky footer, empty-state Add Songs, and Undo for track removal.
- §9: canonical Library tab URLs, standalone redirects, and consistent navigation highlighting.

**Exit criteria**

- Library tabs respond to URL changes after mount; old Playlists/Downloads URLs land on the canonical Library tabs.
- Saved Songs and playlist detail expose primary listening actions without requiring hover or secondary menus.
- Adding songs supports selection review before commit; removing a track is recoverable; deleting a playlist uses the shared destructive dialog.
- Empty, signed-out, small, and large collections all render useful states without duplicate management UI.

### Phase 6 — Authentication, Account, and Settings

**Goal:** reduce account-management friction while keeping validation, recovery, and privacy controls explicit.

**Scope**

- §11: Forgot password placement, narrow-screen name stacking, conditional consent consolidation, inline validation/focus, preserved password visibility/autocomplete, resend countdown, expired-code guidance, and post-verification focus.
- §12 P1: Profile/Security/Data & Privacy grouping, Quick Links cleanup, danger-zone separation, shared sign-out-everywhere confirmation, and metadata wrapping.
- §13 P1: Settings links to Library download management, approximate browser-storage wording, and less abrupt update checks.

**Exit criteria**

- Invalid authentication input is reported beside the relevant field and focus moves to the first invalid field.
- Password visibility and autocomplete behavior remain intact; verification recovery has clear timing and next-step guidance.
- Do not combine Terms/Privacy acceptance until legal approval is recorded; otherwise that recommendation stays **[Pending]**.
- Account sections are navigable, normal sign-out is neutral, and only deletion uses the danger zone.
- Settings no longer duplicates download management; update checks report status before reloading.

### Phase 7 — Admin publishing and moderation

**Goal:** make batch publishing and catalog moderation safe, legible, and usable on mobile.

**Scope**

- §15: three-step publishing flow, accurate dropzone copy/focus state, distinct pending-review status, Start over confirmation, per-file progress/retry failed, and explicit shared-artist confirmation.
- §16: consistent Admin terminology, grouped navigation, moderation/rights/audio-health visibility, non-color health indicators, mobile track cards, accessible icon names, and labelled charts with tabular alternatives.

**Exit criteria**

- An admin can complete select/name → metadata → review/publish without losing track of which fields apply to the whole batch.
- Pending review is visually distinct from published success; Start over cannot silently discard work.
- Retry failed affects only failed files; successful uploads are not repeated.
- Moderation status, rights clearance, and audio health are readable as text/icons, filterable, and usable on mobile.
- Charts have labels and a non-visual/tabular alternative.

### Phase 8 — Notifications, shared songs, legal, and error recovery

**Goal:** align public-facing states and claims with the implemented product, then run the final cross-phase audit.

**Scope**

- §10: consistent read/badge behavior, accessible dismissal, restore-dismissed view, and meaningful CTA labels.
- §14: accurate Ready/Now playing wording, shared-song action hierarchy, post-listening discovery, and song-specific social artwork.
- §17: legal reading experience and active TOC, accessibility-page claim verification, and expanded error recovery options.

**Exit criteria**

- Badge, unread markers, and Mark all read describe the same state; dismissed announcements can be restored on the device where they were dismissed.
- A selected-but-paused shared song is not labelled Now playing; social previews use song-specific artwork.
- Legal pages preserve summary/TOC while improving reading measure; the accessibility page claims only what the final app actually supports.
- Error recovery offers Try again, Go home, and Contact support without implying playback was interrupted.
- Final regression covers every phase, every recommendation tag is reconciled, and any unverified or legally blocked item remains **[Pending]**.

### Verification gates for every phase

Run the repository checks after each phase:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Then verify the affected flows in a browser at narrow mobile, tablet, and desktop widths, including keyboard-only operation, reduced motion, signed-out/signed-in states, and admin states where relevant. Always check that playback survives navigation and that destructive actions have the intended confirmation or Undo path. If a reliable browser surface is unavailable, record that limitation and do not mark visual/interaction recommendations **[Implemented]** based only on code inspection.

### Phase completion rules

- Complete phases in dependency order. Phases 3–7 may be parallelized only after the Phase 2 primitives are stable and owners avoid overlapping files.
- Update a recommendation tag only when the full recommendation is implemented and verified; partial work stays **[Pending]**.
- A phase is complete only when every mapped recommendation is **[Implemented]** and its exit criteria pass.
- Keep verification evidence in the commit/PR description rather than adding a second status system to this document.
