"use client";

import { useSyncExternalStore, useEffect } from "react";

const SEEN_KEY = "lumbo_notifications_seen";
const REFRESH_TTL_MS = 30_000;

// One feed shared by the mobile bell, the sidebar link and the announcements
// page. Without it every mounted component would hit /api/notifications on its
// own, and the bell would disagree with the page about what counts as unread.
const initialSnapshot = {
  items: [],
  // Starts as loading so the server render and the first client paint both show
  // "Loading announcements…" instead of flashing an empty feed that is about
  // to be filled.
  loading: true,
  error: "",
  fetchedAt: 0,
  seenAt: readSeenAt(),
  unread: 0,
};

let snapshot = initialSnapshot;
let inFlight = null;
const listeners = new Set();

function readSeenAt() {
  // This module is evaluated on the server for the first render, where
  // localStorage does not exist.
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(SEEN_KEY) || "";
  } catch {
    return "";
  }
}

function countUnread(items, seenAt) {
  // A listener who has never opened the page has genuinely not seen any of
  // them, so the whole feed counts as unread rather than nothing.
  if (!seenAt) return items.length;
  const seen = Date.parse(seenAt);
  if (!Number.isFinite(seen)) return items.length;
  return items.filter((item) => Date.parse(item.created_at) > seen).length;
}

function setSnapshot(patch) {
  const next = { ...snapshot, ...patch };
  next.unread = countUnread(next.items, next.seenAt);
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export const subscribeNotifications = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getNotificationSnapshot = () => snapshot;

// The server has no announcements cached and no localStorage, so it renders the
// empty snapshot and the client fills it in after hydration.
const getServerSnapshot = () => initialSnapshot;

export const refreshNotifications = async ({ force = false } = {}) => {
  if (!force && snapshot.fetchedAt && Date.now() - snapshot.fetchedAt < REFRESH_TTL_MS) {
    return snapshot.items;
  }
  if (inFlight) return inFlight;

  setSnapshot({ loading: true, error: "" });

  inFlight = fetch("/api/notifications", { credentials: "same-origin" })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Unable to load announcements (${response.status}).`);
      const body = await response.json().catch(() => ({}));
      const items = Array.isArray(body?.notifications) ? body.notifications : [];
      setSnapshot({ items, loading: false, error: "", fetchedAt: Date.now() });
      return items;
    })
    .catch((error) => {
      console.error("Unable to load announcements:", error);
      setSnapshot({ loading: false, error: "Announcements are unavailable right now." });
      return snapshot.items;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
};

export const markNotificationsSeen = () => {
  const seenAt = new Date().toISOString();
  try {
    window.localStorage.setItem(SEEN_KEY, seenAt);
  } catch {
    // Private-mode storage failures only cost the unread badge.
  }
  setSnapshot({ seenAt });
};

/**
 * Reads the shared feed and keeps it warm. Mounted by the bell and the sidebar
 * link; the store de-duplicates the overlapping refresh calls.
 */
export const useNotificationFeed = () => {
  const state = useSyncExternalStore(
    subscribeNotifications,
    getNotificationSnapshot,
    getServerSnapshot
  );

  useEffect(() => {
    refreshNotifications();

    const onVisible = () => {
      if (document.visibilityState === "visible") refreshNotifications({ force: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return state;
};
