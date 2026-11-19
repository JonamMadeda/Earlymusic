"use client";

import { useSyncExternalStore, useEffect } from "react";
import { isSpotlightTarget, normalizeNotificationTarget } from "./notifications";

const SEEN_KEY = "lumbo_notifications_seen";
const REFRESH_TTL_MS = 30_000;
const POLL_MS = 60_000;
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
  // Server clock from the last successful read. Seen marks use it instead of
  // the device clock so a fast clock cannot hide a just-posted announcement.
  serverNow: "",
  unread: 0,
  // Ids that were new at the last refresh. The page keeps highlighting these
  // after markNotificationsSeen clears the badge, so the "new" styling does not
  // flash once and disappear.
  unreadIds: EMPTY_IDS,
});

let snapshot = null;
let inFlight = null;
const listeners = new Set();

// Ids the listener has opened or dismissed during this session. They are
// subtracted from later unread sets so a background refresh does not paint an
// announcement as new again after it has already been dealt with.
const readIds = new Set();

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

// Announcements fall off the feed at the cap, so their ids should not stay in
// the read set for the lifetime of the tab.
function pruneReadIds(items) {
  if (readIds.size === 0) return;
  const live = new Set(items.map((item) => item.id));
  for (const id of readIds) {
    if (!live.has(id)) readIds.delete(id);
  }
}

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
      const serverNow = typeof body?.now === "string" ? body.now : "";
      pruneReadIds(items);
      const latest = getSnapshotInternal();
      const itemIds = new Set(items.map((item) => item.id));
      // The badge is based on seenAt, while the highlights are the ids this
      // visit has not dealt with yet. Keeping them apart is what stops a
      // background refresh from clearing the page's "unread" styling: opening
      // the page moves seenAt forward, so recomputing from seenAt alone would
      // return nothing.
      const freshIds = unreadIdsFor(items, latest.seenAt);
      const unreadIds = [
        ...new Set([
          ...latest.unreadIds.filter((id) => itemIds.has(id)),
          ...freshIds,
        ]),
      ].filter((id) => !readIds.has(id));
      emit({
        ...latest,
        items,
        loading: false,
        error: "",
        fetchedAt: Date.now(),
        serverNow,
        unread: freshIds.filter((id) => !readIds.has(id)).length,
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
  // A device clock ahead of the server used to mark posts made moments later
  // as already read. The feed response carries the authoritative time.
  const seenAt = current.serverNow || new Date().toISOString();
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
      : unreadIdsFor(current.items, current.seenAt).filter(
          (id) => !readIds.has(id)
        ),
  });
};

/**
 * Mark one announcement as read. Opening its link or dismissing it should not
 * leave the "new" rail behind, and the badge should not reappear on the next
 * background refresh. The badge count only drops when it was still showing:
 * opening the page already zeroed it, so this must not resurrect the count.
 */
export const markNotificationRead = (id) => {
  readIds.add(id);
  const current = getSnapshotInternal();
  if (!current.unreadIds.includes(id)) return;
  emit({
    ...current,
    unread: Math.max(0, current.unread - 1),
    unreadIds: current.unreadIds.filter((value) => value !== id),
  });
};

/**
 * Which Spotlight sub-tabs have an unread announcement aimed at them. The
 * Library dot and the sub-tab badges read this instead of duplicating the
 * unread math. "spotlight" is expanded to all four sub-tabs so a general
 * Spotlight post badges the whole section without every child lighting up.
 */
export const spotlightTargetsFor = (state) => {
  const unread = new Set(state?.unreadIds || []);
  const targets = new Set();
  for (const item of state?.items || []) {
    if (!unread.has(item.id)) continue;
    const target = normalizeNotificationTarget(item.target);
    if (!isSpotlightTarget(target)) continue;
    if (target === "spotlight") {
      ["top", "picks", "highlights"].forEach((child) => targets.add(child));
    } else {
      targets.add(target);
    }
  }
  return [...targets];
};

/**
 * Reads the shared feed and keeps it warm. Mounted by the bell and the sidebar
 * link; the store de-duplicates the overlapping refresh calls. A slow poll
 * picks up posts made while a tab stays open; visibility changes force one so
 * returning to the app never shows a stale badge.
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
    const poll = window.setInterval(() => refreshNotifications(), POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  return state;
};
