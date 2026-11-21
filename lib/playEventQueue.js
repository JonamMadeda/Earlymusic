"use client";

import { normalizePlayEventSongId } from "./playEvents";

// Play events are the source of truth for Highlights. A failed POST used to be
// logged and forgotten, which left the tab with a handful of seeded rows and
// made the most recent song win every period. Keep unsent events on the device
// and retry them on reconnect/focus so the ranking catches up across devices.

const STORAGE_KEY = "lumbo_pending_play_events_v1";
const MAX_PENDING = 200;
const RETRY_MS = 60_000;

let pending = null;
let flushing = false;
let started = false;

const client = () => (typeof window === "undefined" ? null : window);

const read = () => {
  if (pending) return pending;
  try {
    const raw = client()?.localStorage?.getItem(STORAGE_KEY) || "";
    const parsed = JSON.parse(raw);
    pending = Array.isArray(parsed)
      ? parsed.filter(
          (event) =>
            event &&
            typeof event.id === "string" &&
            normalizePlayEventSongId(event.song_id)
        )
      : [];
  } catch {
    pending = [];
  }
  return pending;
};

const write = (events) => {
  pending = events.slice(-MAX_PENDING);
  try {
    client()?.localStorage?.setItem(STORAGE_KEY, JSON.stringify(pending));
  } catch {}
};

export const getPendingPlayEvents = () => [...read()];

export function queuePlayEvent(songId, now = Date.now()) {
  const normalized = normalizePlayEventSongId(songId);
  if (!normalized) return;

  const event = {
    id: `${now}-${Math.random().toString(36).slice(2, 10)}`,
    song_id: normalized,
    played_at: new Date(now).toISOString(),
  };
  write([...read(), event]);
  void flushPlayEvents();
}

export async function flushPlayEvents() {
  const win = client();
  if (!win || flushing) return 0;
  const events = read();
  if (events.length === 0) return 0;
  if (win.navigator && win.navigator.onLine === false) return 0;

  flushing = true;
  let sent = 0;
  try {
    for (const event of events) {
      let ok = false;
      try {
        const response = await win.fetch("/api/data/play_events", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          // A page being closed must not lose the final listen.
          keepalive: true,
          body: JSON.stringify({
            song_id: event.song_id,
            played_at: event.played_at,
          }),
        });
        ok = Boolean(response?.ok);
      } catch {}
      if (!ok) break;
      write(read().filter((item) => item.id !== event.id));
      sent += 1;
    }
  } finally {
    flushing = false;
  }
  return sent;
}

export function clearPlayEventQueue() {
  write([]);
}

export function startPlayEventSync() {
  const win = client();
  if (!win || started) return () => {};
  started = true;

  const retry = () => void flushPlayEvents();
  win.addEventListener?.("online", retry);
  win.addEventListener?.("focus", retry);
  const timer = win.setInterval?.(retry, RETRY_MS);
  retry();

  return () => {
    win.removeEventListener?.("online", retry);
    win.removeEventListener?.("focus", retry);
    if (timer) win.clearInterval?.(timer);
    started = false;
  };
}
