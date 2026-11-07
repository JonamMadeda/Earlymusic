"use client";

import { useSyncExternalStore, useEffect } from "react";

const SEEN_KEY = "lumbo_notifications_seen";
const REFRESH_TTL_MS = 30_000;
const EMPTY_IDS = Object.freeze([]);

// One feed shared by the mobile bell, the sidebar link and the announcements
// page. Without it every mounted component would hit /api/notifications on its
// own, and the bell would disagree with the page about what counts as unread.
//
// This snapshot must stay independent of localStorage: getServerSnapshot has
// to return the exact value the server rendered with during hydration. The
// client-only seenAt is layered on lazily in getSnapshotInternal below.
const EMPTY_SNAPSHOT = Object.freeze({
  items: [],
  // Starts as loading so the server render and the first client paint both show
  // "Loading announcements…" instead of flashing an empty feed that is about
  // to be filled.
  loading: true,
  error: "",
  fetchedAt: 0,
  seenAt: "",
  unread: 0,
  // Ids that were new at the last refresh. The page keeps highlighting these
  // after markNotificationsSeen clears the badge, so the "new" styling does not
  // flash once and disappear.
  unreadIds: EMPTY_IDS,
});

let snapshot = null;
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

function unreadIdsFor(items, seenAt) {
  // A listener who has never opened the page has genuinely not seen any of
  // them, so the whole feed counts as unread rather than nothing.
  if (!seenAt) return items.map((item) => item.id);
  const seen = Date.parse(seenAt);
  if (!Number.isFinite(seen)) return items.map((item) => item.id);
  return items
    .filter((item) => Date.parse(item.created_at) > seen)
    .map((item) => item.id);
}

// Built on first client read so localStorage is picked up after hydration
// without changing the value the server snapshot returned.
function getSnapshotInternal() {
  if (!snapshot) {
    snapshot = { ...EMPTY_SNAPSHOT, seenAt: readSeenAt() };
  }
  return snapshot;
}

function emit(next) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export const subscribeNotifications = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getNotificationSnapshot = () => getSnapshotInternal();

// The server has no announcements cached and no localStorage, so it renders the
// empty snapshot and the client fills it in after hydration.
const getServerSnapshot = () => EMPTY_SNAPSHOT;

export const refreshNotifications = async ({ force = false } = {}) => {
  const current = getSnapshotInternal();
  if (!force && current.fetchedAt && Date.now() - current.fetchedAt < REFRESH_TTL_MS) {
    return current.items;
  }
  if (inFlight) return inFlight;

  // Keep an already-populated feed on screen while a background refresh runs;
  // only a cold load needs the skeleton.
  emit({ ...current, loading: current.items.length === 0, error: "" });

  inFlight = fetch("/api/notifications", { credentials: "same-origin" })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Unable to load announcements (${response.status}).`);
      const body = await response.json().catch(() => ({}));
      const items = Array.isArray(body?.notifications) ? body.notifications : [];
      const latest = getSnapshotInternal();
      const unreadIds = unreadIdsFor(items, latest.seenAt);
      emit({
        ...latest,
        items,
        loading: false,
        error: "",
        fetchedAt: Date.now(),
        unread: unreadIds.length,
        unreadIds,
      });
      return items;
    })
    .catch((error) => {
      console.error("Unable to load announcements:", error);
      emit({
        ...getSnapshotInternal(),
        loading: false,
        error: "Announcements are unavailable right now.",
      });
      return getSnapshotInternal().items;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
};

/**
 * Clear the unread badge. The ids that were unread before this visit stay in
 * unreadIds so the page can keep highlighting them; pass clearHighlights to
 * drop those highlights too (the page's "Mark all read" action).
 *
 * The ids are recomputed from the previous seenAt rather than reused from the
 * last refresh: a cached feed can be revisited inside the refresh TTL, and the
 * old set would otherwise make already-seen items look new again.
 */
export const markNotificationsSeen = ({ clearHighlights = false } = {}) => {
  const current = getSnapshotInternal();
  const seenAt = new Date().toISOString();
  try {
    window.localStorage.setItem(SEEN_KEY, seenAt);
  } catch {
    // Private-mode storage failures only cost the unread badge.
  }
  emit({
    ...current,
    seenAt,
    unread: 0,
    unreadIds: clearHighlights
      ? EMPTY_IDS
      : unreadIdsFor(current.items, current.seenAt),
  });
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
