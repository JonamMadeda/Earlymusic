// Shared rules for in-app announcements. The cap lives here rather than in the
// admin form because the trim runs on every insert: a sixteenth notification
// deletes the oldest one, so the list a listener opens is always the newest 15.
export const MAX_NOTIFICATIONS = 15;

export const TITLE_MAX_LENGTH = 120;
export const BODY_MAX_LENGTH = 600;
export const URL_MAX_LENGTH = 300;

export const NOTIFICATION_KINDS = ["news", "update", "release", "warning"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const KIND_LABELS: Record<NotificationKind, string> = {
  news: "News",
  update: "App update",
  release: "New release",
  warning: "Warning",
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
