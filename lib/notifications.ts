// Shared rules for in-app announcements. The cap lives here rather than in the
// admin form because the trim runs on every insert: a sixteenth notification
// deletes the oldest one, so the list a listener opens is always the newest 15.
export const MAX_NOTIFICATIONS = 15;

export const TITLE_MAX_LENGTH = 120;
export const BODY_MAX_LENGTH = 600;
export const URL_MAX_LENGTH = 300;

export const NOTIFICATION_KINDS = ["news", "update", "release", "warning"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

// "general" is the ordinary announcement every listener sees. The four
// standouts targets are the same feed shown in the Library; the client uses
// them to badge the right sub-tab and to decide whether the Library dot should
// light up. Keeping this as a column (rather than parsing the URL) means an
// admin can point a post at the Library without a link.
export const NOTIFICATION_TARGETS = [
  "general",
  "standouts",
  "top",
  "picks",
  "highlights",
] as const;
export type NotificationTarget = (typeof NOTIFICATION_TARGETS)[number];

export const STANDOUTS_TARGETS = ["standouts", "top", "picks", "highlights"] as const;
export type StandoutsTarget = (typeof STANDOUTS_TARGETS)[number];

export const TARGET_LABELS: Record<NotificationTarget, string> = {
  general: "General",
  standouts: "Standouts",
  top: "Top tracks",
  picks: "Picks",
  highlights: "Highlights",
};

export const KIND_LABELS: Record<NotificationKind, string> = {
  news: "News",
  update: "App update",
  release: "New release",
  warning: "Warning",
};

export const normalizeNotificationTarget = (value: unknown): NotificationTarget =>
  (NOTIFICATION_TARGETS as readonly unknown[]).includes(value)
    ? (value as NotificationTarget)
    : "general";

export const isStandoutsTarget = (value: unknown): value is StandoutsTarget =>
  (STANDOUTS_TARGETS as readonly unknown[]).includes(value);

export type NotificationId = number | string;

/**
 * Neon returns bigserial ids as strings ("66"), while locally cached ids used
 * to be numbers. Normalising both sides to the same shape is what lets a
 * dismissed or read tile stay dismissed after a refresh or on another device.
 * Ids beyond Number.MAX_SAFE_INTEGER stay strings rather than losing digits.
 */
export const normalizeNotificationId = (value: unknown): NotificationId | null => {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const numeric = Number(trimmed);
  if (numeric === 0) return null;
  if (Number.isSafeInteger(numeric) && numeric > 0) return numeric;
  return trimmed;
};

export const normalizeNotificationIds = (value: unknown, limit = 50): NotificationId[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<NotificationId>();
  const ids: NotificationId[] = [];
  for (const entry of value) {
    const id = normalizeNotificationId(entry);
    if (id === null || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= limit) break;
  }
  return ids;
};

// Class strings only, so this module stays importable from the API routes.
// Components pair each kind with its own lucide icon.
export const KIND_PILLS: Record<NotificationKind, string> = {
  news: "border-neutral-300 bg-white text-neutral-700",
  update: "border-sky-300 bg-sky-50 text-sky-800",
  release: "border-emerald-300 bg-emerald-50 text-emerald-800",
  warning: "border-amber-300 bg-amber-50 text-amber-800",
};

export const KIND_DOTS: Record<NotificationKind, string> = {
  news: "bg-neutral-400",
  update: "bg-sky-500",
  release: "bg-emerald-500",
  warning: "bg-amber-500",
};

export const KIND_ACCENTS: Record<NotificationKind, string> = {
  news: "bg-neutral-300",
  update: "bg-sky-400",
  release: "bg-emerald-400",
  warning: "bg-amber-400",
};

const FALLBACK_KIND: NotificationKind = "news";

/**
 * The announcement a new track earns the moment it is saved. Kept as a pure
 * function so the wording is testable and the database write can stay in
 * lib/announcement.ts.
 */
export const releaseAnnouncementFor = (song: {
  id?: unknown;
  title?: unknown;
  author?: unknown;
}): { kind: NotificationKind; title: string; body: string; url: string | null } => {
  const title = typeof song.title === "string" ? song.title.trim() : "";
  const author = typeof song.author === "string" ? song.author.trim() : "";
  return {
    kind: "release",
    title: (title || "New song").slice(0, TITLE_MAX_LENGTH),
    body: author
      ? `New from ${author}. It is in the library now.`
      : "Just added to the library.",
    url: song.id == null ? null : `/share/${String(song.id)}`.slice(0, URL_MAX_LENGTH),
  };
};

export const normalizeNotificationKind = (value: unknown): NotificationKind =>
  NOTIFICATION_KINDS.includes(value as NotificationKind)
    ? (value as NotificationKind)
    : FALLBACK_KIND;

/**
 * The tile a track earns when an admin replaces its audio file. It is worded
 * apart from a metadata edit because listeners are told about something they
 * can hear, not about a changed spelling.
 */
export const audioUpdateAnnouncementFor = (song: {
  id?: unknown;
  title?: unknown;
  author?: unknown;
}): { kind: NotificationKind; title: string; body: string; url: string | null } => {
  const title = typeof song.title === "string" ? song.title.trim() : "";
  const author = typeof song.author === "string" ? song.author.trim() : "";
  return {
    kind: "update",
    title: (title || "Song updated").slice(0, TITLE_MAX_LENGTH),
    body: author
      ? `A new recording of ${author}'s track is live in the library.`
      : "A new audio file is live for this track.",
    url: song.id == null ? null : `/share/${String(song.id)}`.slice(0, URL_MAX_LENGTH),
  };
};

/**
 * An optional destination for an announcement. In-app paths are preferred so
 * the link keeps working if the domain changes; anything absolute must be
 * https, which is what keeps `javascript:`, `data:` and plain `http:` out of an
 * anchor's href.
 */
export const normalizeNotificationUrl = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // "//host/path" is protocol-relative: the browser would send listeners to any
  // host the admin pastes, so only single-slash in-app paths count as relative.
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed.slice(0, URL_MAX_LENGTH);
  if (/^https:\/\//i.test(trimmed)) return trimmed.slice(0, URL_MAX_LENGTH);
  return null;
};
