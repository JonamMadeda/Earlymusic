import { db } from "@/lib/neon";
import {
  BODY_MAX_LENGTH,
  MAX_NOTIFICATIONS,
  TITLE_MAX_LENGTH,
  audioUpdateAnnouncementFor,
  normalizeNotificationUrl,
  releaseAnnouncementFor,
  type NotificationKind,
} from "@/lib/notifications";

export type AnnouncementDraft = {
  kind: NotificationKind;
  title: string;
  body?: string | null;
  url?: string | null;
};

/**
 * Write one announcement and enforce the cap in the same breath. Listeners
 * never see more than MAX_NOTIFICATIONS rows, and the newest always survive, so
 * this is the only path that should insert into public.notifications.
 */
export const postAnnouncement = async (
  draft: AnnouncementDraft
): Promise<{ announcement: Record<string, unknown>; evicted: number } | null> => {
  const title = String(draft.title ?? "").trim().slice(0, TITLE_MAX_LENGTH);
  if (!title) return null;

  const url = normalizeNotificationUrl(draft.url);
  const body = String(draft.body ?? "").trim().slice(0, BODY_MAX_LENGTH) || null;

  const { rows } = await db.query(
    `INSERT INTO public.notifications (kind, title, body, url)
     VALUES ($1, $2, $3, $4) RETURNING id, kind, title, body, url, created_at`,
    [draft.kind, title, body, url]
  );
  const announcement = rows?.[0];
  if (!announcement) return null;

  // Postgres has no "keep the newest N" clause, so the trim runs right after
  // the insert. Ordering by id DESC as well breaks ties inside a single now()
  // timestamp, which would otherwise evict the row just posted. RETURNING is
  // required for the count: the HTTP driver reports rowCount 0 for a bare
  // DELETE.
  const trimmed = await db.query(
    `DELETE FROM public.notifications
      WHERE id NOT IN (
        SELECT id FROM public.notifications
         ORDER BY created_at DESC, id DESC
         LIMIT $1
      )
      RETURNING id`,
    [MAX_NOTIFICATIONS]
  );

  return { announcement, evicted: trimmed?.rows?.length || 0 };
};

/**
 * Announce a freshly saved track. Announcing must never break an upload: the
 * bytes are already in R2 and the song row is already committed, so a failed
 * announcement is logged to public.app_errors instead of thrown at the admin.
 * A release announcement is only posted once per song: re-saving the same
 * track does not create a duplicate "New release" tile.
 */
export const announceNewSong = async (song: Record<string, unknown>) => {
  try {
    // The tile links to /share/<id>, which only serves approved tracks.
    if (song.status !== "approved") return null;
    const songId = String(song.id ?? "");
    if (await hasSongAnnouncement(songId)) return null;
    return await postAnnouncement(releaseAnnouncementFor(song));
  } catch (error) {
    await logAnnouncementError("new song", song, error);
    return null;
  }
};

/**
 * Announce that a track was updated (metadata or audio replaced). Listeners
 * hear about a re-release without an admin writing an announcement.
 *
 * A replaced audio file always earns a tile: each swap is one deliberate admin
 * action and listeners can hear the difference, so a second re-recording the
 * same week is not a duplicate. Metadata edits keep the existence check, which
 * is what stops repeated typo fixes from flooding the feed.
 */
export const announceSongUpdate = async (
  song: Record<string, unknown>,
  options: { audioReplaced?: boolean } = {}
) => {
  try {
    if (song.status !== "approved") return null;
    if (options.audioReplaced) return await postAnnouncement(audioUpdateAnnouncementFor(song));
    const songId = String(song.id ?? "");
    // One "updated" tile per song. A release announcement does not block this:
    // the track has genuinely changed since it was first announced. Checking
    // the update kind instead of the release kind is what stops repeated edits
    // from flooding the feed with identical update tiles.
    if (await hasSongAnnouncement(songId, "update")) return null;
    return await postAnnouncement({
      kind: "update",
      title: String(song.title ?? "Song updated").slice(0, TITLE_MAX_LENGTH),
      body: String(song.author ? `Updated from ${song.author}.` : "The track has been updated.").slice(0, BODY_MAX_LENGTH),
      url: song.id == null ? null : `/share/${String(song.id)}`,
    });
  } catch (error) {
    await logAnnouncementError("song update", song, error);
    return null;
  }
};

/**
 * Drop every announcement pointing at a track that no longer exists. Deleting
 * only "release" tiles would leave "update" tiles behind with a dead
 * /share/<id> link, so the URL is the source of truth here.
 */
export const retractSongAnnouncements = async (songId: string | number) => {
  try {
    const { rows } = await db.query(
      `DELETE FROM public.notifications
        WHERE url = $1 RETURNING id`,
      [`/share/${songId}`]
    );
    return rows?.length || 0;
  } catch (error) {
    console.error("Unable to retract song announcements:", error);
    return 0;
  }
};

/**
 * Returns true when an announcement of the given kind already points at this
 * song. New-song posts pass "release" (the default) so re-saving never creates
 * a duplicate release tile; update posts pass "update" so repeated edits do
 * not create a duplicate update tile either.
 */
export const hasSongAnnouncement = async (
  songId: string | number,
  kind: NotificationKind = "release"
) => {
  try {
    const { rows } = await db.query(
      `SELECT id FROM public.notifications
        WHERE kind = $2 AND url = $1 LIMIT 1`,
      [`/share/${songId}`, kind]
    );
    return rows?.length > 0;
  } catch (error) {
    console.error("Unable to check for existing song announcement:", error);
    return false;
  }
};

/**
 * Record a failed announcement so ops can see it in public.app_errors instead
 * of only in the server console.
 */
export const logAnnouncementError = async (
  context: string,
  song: Record<string, unknown>,
  error: unknown
) => {
  try {
    await db.query(
      `INSERT INTO public.app_errors (message, path, detail)
       VALUES ($1, $2, $3)`,
      [
        `Announcement failed (${context}): ${error instanceof Error ? error.message : String(error)}`,
        "/api/admin/songs",
        JSON.stringify({ songId: song.id, songTitle: song.title, error: String(error) }),
      ]
    );
  } catch (logError) {
    console.error("Unable to write announcement error:", logError);
  }
};
