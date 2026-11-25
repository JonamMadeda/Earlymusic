# Homepage UI/UX

> Scope: the `/` route of Luumbo — its layout, visual hierarchy, interaction states, accessibility behavior, and the content rules behind each section.
>
> Source of truth: [`app/page.js`](../../app/page.js), [`app/components/HomeHero.jsx`](../../app/components/HomeHero.jsx), [`app/components/FeaturedCard.jsx`](../../app/components/FeaturedCard.jsx), [`app/components/LazySection.jsx`](../../app/components/LazySection.jsx), [`app/components/Skeleton.jsx`](../../app/components/Skeleton.jsx), and the shared shell in [`app/layout.js`](../../app/layout.js).
>
> Companion documents can live in this same `docs/ui-ux/` folder.

---

## 1. Purpose and mental model

The homepage is a **listening dashboard**, not a marketing landing page. It answers three questions in order:

1. **What can I do right now?** — the hero offers one contextual action (resume, listen, open an announcement, or start listening).
2. **What is worth hearing?** — horizontal rails surface recent, featured, fresh, and unexplored music.
3. **What should I pick next?** — a filterable "Curated for You" list ends the discovery path before the end-of-feed marker.

The page is optimized for:

- **Returning listeners** — playback history drives "Continue Listening", a resume hero, and a "Continue listening" CTA.
- **New listeners** — seeded suggestions, seasonal copy, "Start listening", and broad discovery rails.
- **Small and large catalogues** — rail sizes shrink with small libraries so sections do not repeat the same handful of songs.
- **Mobile-first use** — horizontal snap rails, 44px touch targets on coarse pointers, and a bottom nav/player-aware scroll layout.

The visual language is deliberately restrained: white surfaces, near-black navy accents, neutral gray metadata, subtle borders, and one monochrome "New" badge. Only the full player uses a dark theme.

---

## 2. The app shell around the homepage

The homepage is rendered inside the persistent application shell; it does not own its own page chrome.

| Shell element | Behavior on the homepage |
| --- | --- |
| **Desktop sidebar** (`md+`) | Brand link, Home / Songs / Library / Notifications, optional Admin, recent songs (up to 7), and account/sign-in footer. Hidden below `md`. |
| **Header** | On `/`, shows a full-width search trigger on desktop, a search icon on mobile, notification bell, and sign-in when signed out. The offline status strip appears below the header. |
| **Main scroll container** | `#app-scroll` owns vertical scrolling, not `window`. The shell reserves bottom padding (`pb-44 md:pb-32`) for the mini-player and mobile bottom nav. |
| **Mobile bottom nav** | Home / Songs / Library / Account. Hidden at `md+`. |
| **Persistent player** | Mounted once in the shell. It owns playback controls and live progress; the homepage banner adds active-song context and an "Open player" link without becoming a second player. |
| **Skip link** | Keyboard users can jump directly to `#app-scroll`. |

### Page container

```text
bg-white px-3 pt-4 pb-8
sm:px-6
md:px-8 md:pt-6
mx-auto max-w-5xl
space-y-6 md:space-y-7
```

Sections sit in an inner stack with `space-y-8 md:space-y-10`. The narrow `max-w-5xl` reading width keeps rails and list rows scannable on desktop.

---

## 3. Layout at a glance

Top to bottom:

1. **Hero panel** — greeting, seasonal/contextual headline, primary and secondary actions, metadata, and a context-dependent right rail.
2. **Continue Listening** — only when real listening history exists.
3. **Featured** — editorial-feeling mixed rail.
4. **Recently Added** — the 15 newest tracks with dedicated freshness cards.
5. **Suggested Starters** — only when suggestions exist without real history.
6. **Keep Exploring** — catalogue tracks not already shown in Featured or Fresh.
7. **Curated for You** — filterable list of up to 15 tracks in groups of five.
8. **Empty state** — only when the catalogue is empty.
9. **End-of-feed marker** — divider, thank-you note, and "Back to top".
10. **Floating Back to top** — appears after 400px of scroll.

The layout is a single vertical column at every breakpoint. Only cards inside rails switch to horizontal scrolling; the page itself never becomes a multi-column grid.

---

## 4. Hero panel

The hero is a single surface with a subtle navy wash:

```text
rounded-xl border border-accent/10
bg-gradient-to-br from-accent/[0.07] via-white to-accent/[0.025]
p-4 sm:p-5 md:p-6
```

On `lg+` it is split into a flexible content column and a fixed `18rem` (288px) right rail. Below `lg`, the rail stacks underneath with a top divider.

### 4.1 Greeting and season chips

- **Greeting** is time-of-day based using the listener's local clock:
  - before 12:00 → "Good morning" with sunrise icon
  - 12:00–17:59 → "Good afternoon" with sun icon
  - 18:00+ → "Good evening" with moon icon
- The signed-in user's first name is appended in bold (for example, "Good evening, **Ada**").
- The greeting chip contains only the greeting and optional first name; it has no time-of-day subtitle or altar/vigil tag.
- A **season chip** appears when the worship calendar is in a named season: Advent, Christmas, Lent, or Easter. Ordinary Time shows no chip.
- Seasons are computed locally, including the moving Easter date and the fourth Sunday of Advent.

### 4.2 Hero state machine

The hero chooses **one** state using this precedence:

| Priority | State | Condition | Headline | Primary CTA | Secondary CTA | Right rail |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | **Active** | A song is selected in the player | Active song title, labelled "In your player" | Open player | Shuffle All | Standout card when available, otherwise Scripture card |
| 2 | **Announcement** | An unread, undismissed notification of kind `release` or `update` | Notification title | "Listen now" when it links to a known song, otherwise "Open announcement" | All announcements | New-release card |
| 3 | **New** | Real history exists, there is a track from the last 7 days, and it has not been played | Newest track title, labelled "New this week" | Listen now | Shuffle All | New-release card |
| 4 | **Returning** | Real history exists with at least one recent track | "Pick up where you left off", labelled "Welcome back" | Continue listening | Shuffle All | Standout card |
| 5 | **Discover** | Default for new listeners / no history | Seasonal title or "Worship Sessions" | Start listening (first Featured song) | Shuffle All | Scripture card |

Key details:

- **Playback stays in the persistent player.** The banner reacts to the selected song but omits duration, live progress, timing, and Pause/Resume controls. "Open player" is a navigation shortcut, not a transport control.
- **Shuffle All** is disabled when the catalogue is empty and uses a fresh seeded Fisher–Yates shuffle on every press.
- **Browse songs** is always available as a quiet tertiary link to `/songs`.

### 4.3 Typography and actions

- The contextual label is small, uppercase, tracked, semibold, and accent-colored.
- The hero headline is the page's only `h1` and uses the shared `.page-title` style (20–24px, bold, tight tracking).
- The homepage follows the app's weight ladder: bold headings and rank numerals, semibold song titles/actions/compact labels and badges, medium metadata and chips, and regular body copy. It does not introduce a heavier 900-weight tier.
- Small letter avatars are semibold like the shared mono avatar; cover and hero artwork initials remain bold.
- The description is capped at two lines (`line-clamp-2`) with a `max-w-md` measure.
- Primary and secondary actions use the global `.btn-primary` / `.btn-secondary` patterns, which carry a 44px minimum height.
- Actions wrap on narrow screens rather than overflowing.
- "Browse songs" uses a compact pill link with a 36px minimum height.

### 4.4 Right rail variants

The right rail is contextual, not decorative. Exactly one variant renders:

| Variant | Shown when | Content |
| --- | --- | --- |
| **New card** | Announcement or New | Artwork with an "N" badge, contextual label, title, two-line description |
| **Standout card** | Returning or Active with a standout song other than the active track | "Standout" label, artwork, title, artist, circular play button, "View Standouts" link to `/library?tab=standouts` |
| **Scripture card** | Discover (and any fallback) | Two-line verse, reference, previous / pause / next / copy controls, and a visible failure message if copying is blocked |

Scripture behavior:

- Rotates every **10 seconds**.
- Automatically stops while a track is active in the player.
- Has an explicit pause/resume control (WCAG 2.2.2) and previous/next controls.
- Respects `prefers-reduced-motion`: no auto-rotation and no pause control (there is nothing to pause).
- Copy uses the Clipboard API; a failure is reported inline ("Couldn't copy — select the verse and copy it by hand.") instead of being swallowed.
- A screen-reader `role="status"` announces successful copies.

### 4.5 Statistics and shortcut row

When data is loaded and the catalogue is non-empty, the hero shows one compact metadata row:

- total track count
- artist count
- **"N recently added"** anchor to `#newest-songs`
- **"Continue Listening"** anchor to `#recently-played` when real history exists
- **"Standouts"** link to `/library?tab=standouts`
- **"Sign in to save your place"** when signed out

The row is intentionally understated (`text-xs`, neutral-500) so it supports rather than competes with the primary CTA. The anchors use a 34px minimum target via `.tap-sm`.

---

## 5. Section rails

All card rails share the same `SectionBlock` anatomy.

### 5.1 Section header and controls

```text
[icon] Section title ............................ [←] [→]
```

- Icon is decorative (`aria-hidden`) and neutral.
- Title is an `h2`, connected to the section through `aria-labelledby`.
- Section headers do not repeat bulk playback or catalogue navigation controls; individual cards remain the playback entry points.
- **Chevrons** only render when the rail actually overflows in at least one direction.
  - They are measured live with `ResizeObserver` and `onScroll`.
  - The left/right button is disabled at the corresponding edge.
  - Each scroll moves roughly 80% of the visible rail width.
  - Smooth scrolling becomes instant under reduced motion.
- The rail is a focusable `region` (`tabIndex={0}`) with an accessible label such as "Featured — scrollable worship sessions".
- With the rail focused, **ArrowLeft** and **ArrowRight** scroll it and prevent page scrolling.
- `aria-controls` connects each chevron to its rail.

### 5.2 Rail mechanics

- Horizontal flex with `snap-x snap-mandatory`, `overflow-x-auto`, and `overscroll-x-contain`.
- Cards are `snap-start`.
- Scrollbars are hidden (`.no-scrollbar`) so the rail reads as a shelf rather than a pane.
- A 1px padding plus negative margin preserves focus rings without clipping.
- Touch scrolling is native; no custom drag implementation.

### 5.3 Section inventory

| Order | Section | ID | Icon | Card type | Source | Condition |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | **Continue Listening** | `recently-played` | Clock | History row | `recentlyPlayed` | Real history and non-empty history |
| 2 | **Featured** | `featured-songs` | Star | Album showcase | Praise-first catalogue, shuffled | Catalogue non-empty |
| 3 | **Recently Added** | `newest-songs` | Sparkles | Recently added card | 15 newest tracks | Catalogue non-empty |
| 4 | **Suggested Starters** | `suggested-starters` | Compass | Compact rail card with navy letter tile | Seeded suggestions | No real history, but suggestions exist |
| 5 | **Keep Exploring** | `keep-exploring` | Shuffle | Horizontal pill | Catalogue minus Featured and Fresh, shuffled | Unused tracks remain |
| 6 | **Curated for You** | `recommended` | ListMusic | Tracklist row | Filtered + shuffled catalogue | Recommendations exist or a non-All filter is active |

Behavioral notes:

- **Continue Listening** is a replay surface. Its first row is marked "Last played" until it becomes the active track.
- **Featured** prioritizes the Praise category before mixing in the rest of the catalogue, then de-duplicates and shuffles.
- **Recently Added** is the same list that drives every "New" badge: the 15 most recently added songs by `created_at`, not a time window.
- **Suggested Starters** appears for new listeners because the player seeds up to six suggestions, but those suggestions are never written to listening history.
- **Keep Exploring** deliberately excludes Featured and Fresh so it does not immediately repeat them.
- **Curated for You** is the broadest list and does not exclude tracks shown above it.

### 5.4 Rail sizing with small libraries

Featured and Keep Exploring use a shrinking rail size:

```text
if total >= base * 2 → base
else → max(4, ceil(total / 3))
```

- Featured base: **15**
- Keep Exploring base: **12**

This prevents a 20-song library from showing the same songs in every rail. Very small catalogues still get a minimum of four cards where possible.

### 5.5 Stable, session-seeded shuffles

Rails shuffle with a seeded Fisher–Yates helper rather than `sort(() => Math.random() - 0.5)`.

- The seed combines the current song ID list and a per-mount session seed.
- Order stays stable while listening and navigating in the session.
- Adding or removing a song changes the ID key and reshuffles naturally.
- Shuffle All uses a fresh random seed on each press so the action is visibly different every time.

---

## 6. Card designs

Every card is a real `<button>`, so it is keyboard reachable by default. Each card includes a screen-reader-only "Play: " prefix and sets `aria-current="true"` when it is the active track. Hovering a card prefetches its audio.

| Card | Used in | Shape and size | Visual language | Active state |
| --- | --- | --- | --- | --- |
| **SongRailCard** | Keep Exploring / Suggested Starters | Horizontal pill; `74vw` / 260px / 275px | Mono letter avatar (navy in Suggested Starters), title, artist, tinted play chip | Accent border and inset ring, accent title, soft pulsing dot, filled play chip |
| **SpotifyCard** | Featured | Vertical cover card; 160px / 184px | Square navy "cover" with category badge, large initial, retro grooves, white play circle | Accent border/ring, accent title, soft pulsing white dot |
| **FeaturedCard** | Recently Added | Vertical centered card; 152px / 168px | Freshness stamp ("2d ago"), rounded letter artwork, overlapping play trigger | Accent border/ring, filled accent artwork, soft pulsing dot, accent title |
| **RecommendationCard** | Curated for You | Full-width row | Two-digit index, avatar, title/artist, category chip on `sm+`, play chip | Soft pulsing dot replaces index, accent ring, accent title |
| **HistoryCard** | Continue Listening | Horizontal row; `min(80vw, 320px)` | Index, navy letter avatar, title/artist, "Last played" on first row | Soft pulsing dot replaces index, accent border and tint, filled play chip |

Shared card rules:

- Titles are single-line, truncated, and semibold; the artist line never drifts because a title wraps.
- "New" badges are semibold; duration, posture, and artist metadata stay medium so they do not compete with titles.
- Borders stay one pixel in every state to avoid layout shift.
- The active state uses **more than color**: ring, filled control, one soft pulsing dot, and `aria-current`.
- "New" badges use the `ink` token, a monochrome near-black tint rather than a warm accent; the badge also carries explicit "New" or "N" text.
- Cards use `rounded-xl` while controls inside them use smaller radii.
- Cards remain one consistent height per rail.

---

## 7. Curated for You

This is the only homepage section with user-controlled filtering.

### 7.1 Header

- Rounded icon tile plus "Curated for You" heading.
- The header has no bulk playback or catalogue navigation actions; playback starts from an individual recommendation row.

### 7.2 Filters

Filter pills sit **inside the section they control**, directly below the header — not above the fold. The filter group is labelled "Filter Curated for You".

| Filter | Selection rule |
| --- | --- |
| **All** | Entire catalogue |
| **Praise** | Category contains "praise" (case-insensitive) |
| **Worship** | Category contains "worship" (case-insensitive) |
| **New** | The same 15 newest tracks used by Recently Added |

Behavior:

- Selected pill: navy fill, white text, `aria-pressed="true"`.
- Unselected: white with a neutral border; hover darkens the border and surface.
- Pills are at least 34px tall and wrap on narrow screens.
- Changing a filter **does not scroll the page**. This is deliberate; the user can see both the filter and its results.
- The filter is synced to `?filter=<id>` with `router.push`/`replace(..., { scroll: false })`; `popstate` restores it on Back/Forward, and invalid values fall back to **All**.

### 7.3 Results

- Up to **15** recommendations, shuffled with a filter-specific seed.
- Rendered in groups of five, each group a vertical stack.
- Results area reserves `min-h-[60dvh]` so short result sets do not clamp the page and shift the filter row.
- If a filter matches nothing, a dashed panel says: "No songs match this filter" with a hint to try another filter. A **Show all sessions** button clears the filter, and an `aria-live="polite"` line announces the matching session count.
- Each row plays immediately and queues the full filtered recommendation list.

---

## 8. Page states

### 8.1 Loading

- The hero renders immediately with `isLoading` suppressing the statistics row.
- The entire main content below the hero is replaced by `PageSkeleton` with three letter-group placeholders.
- Sections are not rendered until loading completes, so there is no flash of empty rails.

> Implementation note: `PageSkeleton` renders a plain `div` with `aria-busy="true"`, so the shell's `<main>` remains the only main landmark while loading.

### 8.2 Load error

- A neutral alert panel appears above the sections: "Songs could not be loaded. Check your connection and try again."
- **Try again** increments a retry counter, re-running the fetch.
- The error is announced with `role="alert"`.
- The empty state is suppressed while an error is showing, so the page does not claim the library is empty.

### 8.3 Empty catalogue

- Centered sparkle tile, headline, and explanatory copy.
- **Admin:** "Your library is empty" plus an "Upload a Song" primary button to `/upload`.
- **Non-admin:** "No songs yet" plus copy explaining that recordings will appear when added.
- No rails, no curated list, and no end-of-feed marker.

### 8.4 End of feed

Only when the catalogue is non-empty:

- A horizontal rule with a circular music icon.
- "You've reached the end".
- "Thanks for worshipping with us today."
- A secondary "Back to top" button.

### 8.5 Floating Back to top

- Appears once the `#app-scroll` container is more than **400px** down.
- Smooth scroll unless reduced motion is enabled.
- Sits above the mini-player when a track is active (`bottom-40 md:bottom-24`), otherwise lower (`bottom-24 md:bottom-8`).
- On mobile it sits bottom-left; on desktop bottom-right.
- Carries a navy ring against white so it stays visible over cards.

---

## 9. Interaction and feedback rules

| Interaction | Feedback |
| --- | --- |
| Play a card | Playback starts immediately; the card becomes active everywhere |
| Hover a card | Audio is prefetched; play affordance gains contrast |
| Active track | Ring/border, accent title, soft pulsing dot, `aria-current` |
| Rail overflow | Chevrons fade in and enable only in scrollable directions |
| Filter change | Pills update instantly; list reshuffles without page movement |
| Copy scripture | Check icon plus screen-reader status; inline error if denied |
| Fetch failure | Alert with retry |
| Empty filter | Dashed explanatory panel |

Queue semantics matter: playing from a rail passes that rail as the queue, so Next/Previous stay within the context the listener chose. History and suggestion rows pass `recentlyPlayed`; Featured and Fresh pass their rail; curated rows pass the filtered recommendations.

---

## 10. Accessibility checklist

The homepage currently implements:

- One page `h1` in the hero and `h2` per section.
- Sections connected to headings with `aria-labelledby`.
- A single main landmark from the app shell, including while the loading skeleton is visible.
- A skip link to the scroll container.
- Real buttons for every card, not clickable divs.
- `aria-current="true"` on the active track in all five card types.
- Screen-reader-only "Play: " context before card content.
- Scoped accessible names for scroll, copy, verse, and back-to-top controls.
- Playback progress and timing remain available in the persistent player, without a duplicate hero progress bar.
- Arrow-key scrolling on focused rails.
- Visible focus rings across the app (navy outline with offset; white in the dark player).
- Coarse-pointer minimums: 44px for ordinary controls, 52px for large CTAs, 34px for dense chips/icon buttons.
- Active and "New" states communicated with text/shape, not color alone.
- Reduced-motion support for smooth scrolling, lazy-section reveals, waveforms, vinyl spin, and scripture rotation.
- Copy failures announced inline rather than silently ignored.

Potential accessibility follow-ups:

- The hero `h1` is **dynamic** (notification title, seasonal phrase, or listening prompt), so the page's top-level heading does not consistently name the destination.
- The statistics row packs several small links into one line; narrow screens may benefit from fewer simultaneous actions.
- Rails are horizontal scroll regions with `tabIndex=0`; each card is separately focusable, which is correct but produces a long tab sequence on large libraries.

---

## 11. Content and personalization rules

| Rule | Value |
| --- | --- |
| "New" definition | 15 most recently added songs by `created_at` |
| "Recently added" in hero | Songs created within the last 7 days |
| Recently played cap | 10 tracks (seeded suggestions capped at 6) |
| Featured rail | Praise-first, de-duplicated, seeded shuffle, up to 15 |
| Keep Exploring | Excludes Featured and Fresh, seeded shuffle, up to 12 |
| Standout | One song drawn randomly from the **entire** catalogue |
| Curated list | Filtered, seeded shuffle, up to 15 |
| Curated groups | Five rows per group |
| Rail order stability | Fixed for the session unless the catalogue changes |
| Shuffle All | Fresh seeded Fisher–Yates order on every press |

The standalone "standout" is intentionally drawn from the whole catalogue rather than the newest tracks, so older recordings still get surfaced.

---

## 12. Visual tokens used on this page

| Token / pattern | Value / behavior |
| --- | --- |
| `--color-accent` | `#0f172a` (near-black navy) |
| `--color-ink` | `#404040` — monochrome by design; used for the "New" badge tint, not a warm accent |
| Page background | White |
| Card border | `border-neutral-200`, one-pixel in every state |
| Hero radius | `rounded-xl` |
| Card radius | `rounded-xl` (compact controls inside use smaller radii) |
| Button radius | `--radius-button: 1rem` |
| Hero headline | `.page-title` — 20px, 24px at `sm+` |
| Rail headings | `.section-title` — 16px, 18px at `sm+` |
| Body/metadata | 14px titles, 12px artist/metadata, 10px labels in tight spaces |
| Body font | Inter (loaded in the root layout) |
| Animation | Lazy-section fade/rise 450ms; active-song pulse 1.4s; scripture 10s; all disabled or reduced under reduced motion |

The `ink` name reflects the value: a neutral near-black used only for the "New" badge so it does not become a competing CTA color. Navy remains the only brand accent.

---

## 13. Design rationale and known trade-offs

**Why rails rather than grids on mobile?**
Horizontal snap rails keep each shelf to one row, preserve scanability, and avoid a wall of cards. Cards are sized in `vw` on phones so the next card peeks in and signals scrollability.

**Why two different featured card silhouettes?**
Featured uses square album covers; Recently Added uses a centered square letter tile and a freshness stamp. The distinction helps two similar discovery rails feel editorially different even though both draw from the same catalogue.

**Why filters live inside Curated for You.**
An earlier pattern placed filters near the top and scrolled the user to the content. The current pattern keeps cause and effect together and never moves the page under the user's finger.

**Why the hero is playback-aware but not a second player.**
The banner reflects the selected song and links back to the persistent player, which alone owns live timing and transport controls. This keeps the banner connected to the current session without repeating durations, progress, or Pause/Resume controls.

Remaining opportunities:

- Distinguish **Featured** and **Keep Exploring** more strongly; both are shuffled catalogue selections with overlapping character.
- Keep the filter result count and **Show all** reset prominent on narrow screens.
- Decide whether the translated `h1` should remain the hero title or whether the stable "Luumbo Home — " prefix should become the whole heading.

---

## 14. Source map

| Concern | File |
| --- | --- |
| Page composition, sections, filters, empty/error/end states | [`app/page.js`](../../app/page.js) |
| Hero greeting, active-song context, seasonal state machine, verse capsule | [`app/components/HomeHero.jsx`](../../app/components/HomeHero.jsx) |
| Recently Added card | [`app/components/FeaturedCard.jsx`](../../app/components/FeaturedCard.jsx) |
| Lazy reveal behavior | [`app/components/LazySection.jsx`](../../app/components/LazySection.jsx) |
| Loading skeleton | [`app/components/Skeleton.jsx`](../../app/components/Skeleton.jsx) |
| App shell, scroll container, skip link | [`app/layout.js`](../../app/layout.js) |
| Design tokens, button/card classes, motion, touch targets | [`app/globals.css`](../../app/globals.css) |
| New-song definition | [`lib/newSongs.js`](../../lib/newSongs.js) |
| Seasonal copy and computed liturgical dates | [`lib/worshipSeason.js`](../../lib/worshipSeason.js) |
| Playback history, suggestions, queue semantics | [`app/context/PlayerContext.js`](../../app/context/PlayerContext.js) |
| Homepage regression guards | [`tests/homepageGuards.test.ts`](../../tests/homepageGuards.test.ts) |
| Broader UI/UX audit and delivery phases | [`UI_UX_AUDIT.md`](../../UI_UX_AUDIT.md) |
