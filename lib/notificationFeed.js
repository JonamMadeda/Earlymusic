"use client";

import { useSyncExternalStore, useEffect } from "react";
import {
  isStandoutsTarget,
  normalizeNotificationId,
  normalizeNotificationTarget,
} from "./notifications";
import {
  getNotificationState,
  hydrateNotificationState,
  setNotificationState,
  subscribeNotificationState,
} from "./notificationState";

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
  dismissedIds: EMPTY_IDS,
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

// Ids the listener has opened or dismissed. They are subtracted from later
// unread sets so a background refresh does not paint an announcement as new
// again after it has already been dealt with. Seeded from the synced cache.
const readIds = new Set(getNotificationState().readIds);

function readSeenAt() {
  return getNotificationState().seenAt;
}

function unreadIdsFor(items, seenAt) {
  // Neon hands back bigint ids as strings; normalise here so they match the
  // ids persisted by the read/dismiss state instead of silently never matching.
  const ids = (list) =>
    list
      .map((item) => normalizeNotificationId(item.id))
      .filter((id) => id !== null);
  // A listener who has never opened the page has genuinely not seen any of
  // them, so the whole feed counts as unread rather than nothing.
  if (!seenAt) return ids(items);
  const seen = Date.parse(seenAt);
  if (!Number.isFinite(seen)) return ids(items);
  return ids(items.filter((item) => Date.parse(item.created_at) > seen));
}

// Built on first client read so localStorage is picked up after hydration
// without changing the value the server snapshot returned.
function getSnapshotInternal() {
  if (!snapshot) {
    const persisted = getNotificationState();
    snapshot = {
      ...EMPTY_SNAPSHOT,
      seenAt: persisted.seenAt,
      dismissedIds: persisted.dismissedIds,
    };
  }
  return snapshot;
}

function emit(next) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

// Every mutation writes the shared blob; notificationState.js debounces the
// Postgres sync so a burst of "mark read" clicks becomes one request.
const persist = (dismissedIds) => {
  const current = getSnapshotInternal();
  setNotificationState({
    seenAt: current.seenAt,
    readIds: [...readIds],
    dismissedIds: dismissedIds || current.dismissedIds,
  });
};

export const subscribeNotifications = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getNotificationSnapshot = () => getSnapshotInternal();

// The server has no announcements cached and no localStorage, so it renders the
// empty snapshot and the client fills it in after hydration.
const getServerSnapshot = () => EMPTY_SNAPSHOT;

// Signing in on a new device brings the account's seen/read/dismissed state
// with it. Recompute the badge from the feed we already have; a later refresh
// uses the same seenAt.
subscribeNotificationState((remote) => {
  const local = getSnapshotInternal();
  readIds.clear();
  (remote.readIds || []).forEach((id) => readIds.add(id));
  const seenAt = remote.seenAt || local.seenAt;
  const unreadIds = unreadIdsFor(local.items, seenAt).filter((id) => !readIds.has(id));
  emit({
    ...local,
    seenAt,
    dismissedIds: remote.dismissedIds || EMPTY_IDS,
    unreadIds,
    unread: unreadIds.length,
  });
});

// Announcements fall off the feed at the cap, so their ids should not stay in
// the read set for the lifetime of the tab.
function pruneReadIds(items) {
  if (readIds.size === 0) return;
  const live = new Set(
    items.map((item) => normalizeNotificationId(item.id)).filter((id) => id !== null)
  );
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
      const itemIds = new Set(
        items.map((item) => normalizeNotificationId(item.id)).filter((id) => id !== null)
      );
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
  const unreadIds = clearHighlights
    ? EMPTY_IDS
    : unreadIdsFor(current.items, current.seenAt).filter((id) => !readIds.has(id));
  emit({ ...current, seenAt, unread: 0, unreadIds });
  persist();
};

/**
 * Mark one announcement as read. Opening its link or dismissing it should not
 * leave the "new" rail behind, and the badge should not reappear on the next
 * background refresh. The badge count only drops when it was still showing:
 * opening the page already zeroed it, so this must not resurrect the count.
 */
export const markNotificationRead = (id) => {
  const normalized = normalizeNotificationId(id);
  if (normalized !== null) readIds.add(normalized);
  const current = getSnapshotInternal();
  persist();
  if (normalized === null || !current.unreadIds.includes(normalized)) return;
  emit({
    ...current,
    unread: Math.max(0, current.unread - 1),
    unreadIds: current.unreadIds.filter((value) => value !== normalized),
  });
};

/** Dismissals live in the shared store so they follow the account too. */
export const dismissNotification = (id) => {
  const normalized = normalizeNotificationId(id);
  if (normalized === null) return;
  readIds.add(normalized);
  const current = getSnapshotInternal();
  const dismissedIds = current.dismissedIds.includes(normalized)
    ? current.dismissedIds
    : [...current.dismissedIds, normalized];
  emit({
    ...current,
    dismissedIds,
    unread: Math.max(0, current.unread - (current.unreadIds.includes(normalized) ? 1 : 0)),
    unreadIds: current.unreadIds.filter((value) => value !== normalized),
  });
  persist(dismissedIds);
};

/** Undo keeps the item read; it only restores it to the visible feed. */
export const undismissNotification = (id) => {
  const normalized = normalizeNotificationId(id);
  if (normalized === null) return;
  const current = getSnapshotInternal();
  const dismissedIds = current.dismissedIds.filter((value) => value !== normalized);
  emit({ ...current, dismissedIds });
  persist(dismissedIds);
};

/**
 * Which Standouts sub-tabs have an unread announcement aimed at them. The
 * Library dot and the sub-tab badges read this instead of duplicating the
 * unread math. "standouts" is expanded to all four sub-tabs so a general
 * Standouts post badges the whole section without every child lighting up.
 */
export const standoutsTargetsFor = (state) => {
  const unread = new Set(state?.unreadIds || []);
  const targets = new Set();
  for (const item of state?.items || []) {
    const id = normalizeNotificationId(item.id);
    if (id === null || !unread.has(id)) continue;
    const target = normalizeNotificationTarget(item.target);
    if (!isStandoutsTarget(target)) continue;
    if (target === "standouts") {
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
    hydrateNotificationState();

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
