// Rules shared by the play-event writer and the API route.
//
// A play timestamp comes from the listening device so an event recorded while
// offline still lands in the day it happened. Devices can also be wrong by
// hours or days, so the server keeps the client time only inside a sane window
// and otherwise stamps the event when it arrives.

const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function normalizePlayEventSongId(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const id = String(value).trim();
  // public.songs.id is a BIGINT. Reject ids that could never match a row
  // instead of writing an event the highlights cannot resolve to a song.
  return /^\d+$/.test(id) ? id : null;
}

export function normalizePlayedAt(value: unknown, now = Date.now()): string {
  const parsed = Date.parse(typeof value === "string" ? value : "");
  const recentEnough = parsed >= now - MAX_EVENT_AGE_MS;
  const notInFuture = parsed <= now + MAX_FUTURE_SKEW_MS;
  if (Number.isFinite(parsed) && recentEnough && notInFuture) {
    return new Date(parsed).toISOString();
  }
  return new Date(now).toISOString();
}
