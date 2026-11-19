"use client";

// One persisted state blob for the notification surfaces. The feed owns the
// seen time / read / dismissed ids, the Library nudge owns its seen keys,
// snooze and preferences. Both call setNotificationState(patch); this module
// keeps the localStorage cache (so signed-out listeners still work) and syncs
// the whole blob to Postgres when there is a session. Keeping the sync here
// means the two stores never race each other's writes.

const CACHE_KEY = "lumbo_notification_state_v1";
const LEGACY_SEEN = "lumbo_notifications_seen";
const LEGACY_DISMISSED = "lumbo_notifications_dismissed";
const LEGACY_NUDGE = "luumbo_library_spotlight_nudge";
const SAVE_DEBOUNCE_MS = 900;

let state = null;
let hydrated = false;
let hydrateInFlight = null;
let saveTimer = null;
const listeners = new Set();

const storage = () => (typeof window === "undefined" ? null : window.localStorage);
const safeGet = (key) => {
  try {
    return storage()?.getItem(key) || "";
  } catch {
    return "";
  }
};
const safeSet = (key, value) => {
  try {
    storage()?.setItem(key, value);
  } catch {
    // Private mode: the in-memory copy still works for this tab.
  }
};
const safeRemove = (key) => {
  try {
    storage()?.removeItem(key);
  } catch {
    // Ignore.
  }
};

const idList = (value) =>
  Array.isArray(value)
    ? [...new Set(value.filter((id) => Number.isSafeInteger(id) && id > 0).slice(0, 50))]
    : [];
const blob = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const normalize = (raw) => ({
  seenAt: typeof raw?.seenAt === "string" ? raw.seenAt : "",
  dismissedIds: idList(raw?.dismissedIds),
  readIds: idList(raw?.readIds),
  nudge: blob(raw?.nudge),
  preferences: blob(raw?.preferences),
});

const isEmpty = (value) =>
  !value.seenAt &&
  value.dismissedIds.length === 0 &&
  value.readIds.length === 0 &&
  Object.keys(value.nudge).length === 0 &&
  Object.keys(value.preferences).length === 0;

const storeLocal = (value) => safeSet(CACHE_KEY, JSON.stringify(value));

function load() {
  if (state) return state;
  let parsed = {};
  const raw = safeGet(CACHE_KEY);
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }
  }
  const next = normalize(parsed);

  // One-time upgrade from the old per-feature keys. Nothing reads them after
  // this, so they can go as soon as their values have been folded in.
  const legacySeen = safeGet(LEGACY_SEEN);
  const legacyDismissed = safeGet(LEGACY_DISMISSED);
  const legacyNudge = safeGet(LEGACY_NUDGE);
  if (!next.seenAt && legacySeen) next.seenAt = legacySeen;
  if (next.dismissedIds.length === 0 && legacyDismissed) {
    try {
      next.dismissedIds = idList(JSON.parse(legacyDismissed));
    } catch {
      // A corrupt old value is simply dropped.
    }
  }
  if (Object.keys(next.nudge).length === 0 && legacyNudge) {
    next.nudge = { seenKeys: [legacyNudge] };
  }

  state = next;
  if (legacySeen || legacyDismissed || legacyNudge) {
    [LEGACY_SEEN, LEGACY_DISMISSED, LEGACY_NUDGE].forEach(safeRemove);
    storeLocal(next);
  }
  return state;
}

/** Current local state. Safe to call during SSR: returns the empty object. */
export const getNotificationState = () => (state ? { ...state } : { ...load() });

/**
 * Merge a partial update into the cache and schedule a sync. Deliberately does
 * not notify subscribers: the caller already owns the in-memory store it just
 * updated, and an echo here would loop.
 */
export const setNotificationState = (patch) => {
  const next = normalize({ ...load(), ...patch });
  state = next;
  storeLocal(next);
  scheduleSave();
};

/** Subscribers only hear about remote hydration, which can change both stores. */
export const subscribeNotificationState = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const scheduleSave = () => {
  // Test stubs (and SSR) have no location; a debounced fetch there is noise.
  if (typeof window === "undefined" || !window.location) return;
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    flushNotificationState();
  }, SAVE_DEBOUNCE_MS);
};

export const flushNotificationState = async () => {
  if (saveTimer && typeof window !== "undefined") {
    window.clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (typeof window === "undefined" || !window.location) return;
  try {
    const response = await fetch("/api/notification-state", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(load()),
    });
    // 401 simply means there is no account; the local cache is still valid.
    // Any other failure leaves the cache intact for the next attempt.
    void response;
  } catch {
    // Offline: local cache remains the source of truth until we reconnect.
  }
};

/**
 * Pull the signed-in account's state once per page load. Signed-out requests
 * get a 401 and are ignored. An empty remote row does not wipe a fuller local
 * cache (e.g. state accrued while signed out); it is pushed back up instead.
 */
export const hydrateNotificationState = async () => {
  if (typeof window === "undefined" || !window.location) return load();
  if (hydrated) return load();
  if (hydrateInFlight) return hydrateInFlight;
  hydrated = true;

  hydrateInFlight = fetch("/api/notification-state", { credentials: "same-origin" })
    .then(async (response) => {
      if (!response.ok) return load();
      const body = await response.json().catch(() => ({}));
      const remote = normalize(body?.state);
      const local = load();
      const next = isEmpty(remote) && !isEmpty(local) ? local : remote;
      state = next;
      storeLocal(next);
      if (!isEmpty(local) && isEmpty(remote)) scheduleSave();
      listeners.forEach((listener) => listener(next));
      return next;
    })
    .catch(() => load())
    .finally(() => {
      hydrateInFlight = null;
    });

  return hydrateInFlight;
};
