import { db } from "@/lib/neon";
import {
  BODY_MAX_LENGTH,
  MAX_NOTIFICATIONS,
  TITLE_MAX_LENGTH,
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
 * announcement is logged for the ops table instead of thrown at the admin.
 */
export const announceNewSong = async (song: Record<string, unknown>) => {
  try {
    return await postAnnouncement(releaseAnnouncementFor(song));
  } catch (error) {
    console.error("Unable to announce the new song:", error);
    return null;
  }
};

/**
 * Drop the announcements pointing at a track that no longer exists, so a
 * deleted song cannot leave a "New release" tile that opens an invalid link.
 */
export const retractSongAnnouncements = async (songId: string | number) => {
  try {
    const { rows } = await db.query(
      `DELETE FROM public.notifications
        WHERE kind = 'release' AND url = $1 RETURNING id`,
      [`/share/${songId}`]
    );
    return rows?.length || 0;
  } catch (error) {
    console.error("Unable to retract song announcements:", error);
    return 0;
  }
};
