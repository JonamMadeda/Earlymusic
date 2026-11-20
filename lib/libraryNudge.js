"use client";

import { useSyncExternalStore } from "react";
import {
  getNotificationState,
  hydrateNotificationState,
  setNotificationState,
  subscribeNotificationState,
} from "./notificationState";
import {
  getNotificationSnapshot,
  markNotificationRead,
  standoutsTargetsFor,
  subscribeNotifications,
} from "./notificationFeed";
import {
  isStandoutsTarget,
  normalizeNotificationId,
  normalizeNotificationTarget,
} from "./notifications";

// The Library dot used to be a pure clock timer, which promised "new picks"
// even when nothing had changed. It now listens to three real signals:
//   1. unread announcements aimed at a Standouts sub-tab (admin-driven),
//   2. new/changed Picks for this listener (published by the Library page),
//   3. a changed Highlights leader (also published by the Library page).
// The optional "daily" mode keeps the original time-boxed attention nudge for
// listeners who want it; "off" and "snooze" let them opt out entirely.

const WINDOW_HOURS = [7, 12, 18];
const WINDOW_MINUTES = 45;
export const NUDGE_MODES = ["content", "daily", "off"];
const SNOOZE_MS = 2 * 60 * 60 * 1000;

const SERVER_SNAPSHOT = Object.freeze({
  active: false,
  reason: "",
  reasonLabel: "",
  windowLabel: "",
  targets: Object.freeze({ top: false, picks: false, highlights: false }),
  mode: "content",
  windowHour: null,
  snoozed: false,
});

const localDayKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/**
 * Which daily window (if any) the supplied time falls in. One of breakfast,
 * lunch or evening is picked per calendar day unless the listener chose a
 * fixed hour, so the dot is time-boxed and appears at most once a day.
 */
export function libraryNudgeWindow(date = new Date(), preferredHour = null) {
  const scheduledHour = WINDOW_HOURS.includes(preferredHour)
    ? preferredHour
    : WINDOW_HOURS[date.getDate() % WINDOW_HOURS.length];
  const minutes = date.getHours() * 60 + date.getMinutes();
  const start = scheduledHour * 60;
  if (minutes >= start && minutes < start + WINDOW_MINUTES) {
    return {
      key: `${localDayKey(date)}-${scheduledHour}`,
      label: scheduledHour < 12 ? "this morning" : scheduledHour < 17 ? "at lunch" : "this evening",
    };
  }
  return null;
}

const nudgeState = () => {
  const nudge = getNotificationState().nudge;
  return nudge && typeof nudge === "object" && !Array.isArray(nudge) ? nudge : {};
};

const seenKeys = () => {
  const keys = nudgeState().seenKeys;
  return Array.isArray(keys) ? keys : [];
};

const acknowledged = () => {
  const signals = nudgeState().signals;
  return signals && typeof signals === "object" && !Array.isArray(signals) ? signals : {};
};

const pickFingerprint = (picks) => {
  if (!Array.isArray(picks) || picks.length === 0) return "";
  return picks
    .map((pick) => `${pick.period}:${pick.song_id}:${pick.created_at || ""}`)
    .sort()
    .join("|");
};

// Only the *leader* matters for Highlights. Counting plays would re-light the
// dot after every single play, which is noise rather than news.
const highlightFingerprint = (highlights) => {
  if (!Array.isArray(highlights) || highlights.length === 0) return "";
  return highlights
    .map((row) => `${row.key || row.period}:${row.song?.id ?? row.song_id ?? ""}`)
    .join("|");
};

// The Library page publishes the rows it already fetched; the nudge store does
// not issue its own requests or duplicate the ranking logic.
let publishedContent = { picks: null, highlights: null };

export const publishStandoutsContent = ({ picks, highlights } = {}) => {
  publishedContent = {
    picks: Array.isArray(picks) ? picks : null,
    highlights: Array.isArray(highlights) ? highlights : null,
  };
  refreshLibraryNudge();
};

function contentTargets() {
  const targets = {};
  const seen = acknowledged();
  const picks = pickFingerprint(publishedContent.picks);
  if (picks && seen.picks !== picks) targets.picks = true;
  const highlights = highlightFingerprint(publishedContent.highlights);
  if (highlights && seen.highlights !== highlights) targets.highlights = true;
  return targets;
}

function announcementTargets() {
  const targets = {};
  standoutsTargetsFor(getNotificationSnapshot()).forEach((target) => {
    targets[target] = true;
  });
  return targets;
}

function buildSnapshot(date = new Date()) {
  const nudge = nudgeState();
  const mode = NUDGE_MODES.includes(nudge.mode) ? nudge.mode : "content";
  const windowHour = WINDOW_HOURS.includes(nudge.windowHour) ? nudge.windowHour : null;
  const snoozedUntil = Date.parse(nudge.snoozedUntil || "");
  const snoozed = Number.isFinite(snoozedUntil) && snoozedUntil > date.getTime();
  const settings = { mode, windowHour, snoozed };

  if (mode === "off" || snoozed) return { ...SERVER_SNAPSHOT, ...settings };

  const targets = { ...contentTargets(), ...announcementTargets() };
  let windowLabel = "";
  if (mode === "daily") {
    const activeWindow = libraryNudgeWindow(date, windowHour);
    if (activeWindow && !seenKeys().includes(activeWindow.key)) {
      windowLabel = activeWindow.label;
    }
  }

  const hasContent = Object.values(targets).some(Boolean);
  if (!hasContent && !windowLabel) return { ...SERVER_SNAPSHOT, ...settings };
  return {
    ...settings,
    active: true,
    reason: hasContent ? "content" : "daily",
    reasonLabel: hasContent ? "Standouts activity" : `Standouts picks ${windowLabel}`,
    windowLabel,
    targets,
  };
}

let snapshot = SERVER_SNAPSHOT;
let timer = null;
let lastSubscribers = 0;
const listeners = new Set();

function emit(next) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function ensureTimer() {
  if (timer || typeof window === "undefined") return;
  // Re-check at the next minute boundary so a tab left open crosses into or
  // out of a window without needing a reload.
  timer = window.setInterval(() => emit(buildSnapshot()), 60_000);
}

function onFocusOrVisible() {
  emit(buildSnapshot());
}

export const subscribeLibraryNudge = (listener) => {
  listeners.add(listener);
  if (lastSubscribers === 0) {
    ensureTimer();
    if (typeof window !== "undefined") {
      window.addEventListener("focus", onFocusOrVisible);
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", onFocusOrVisible);
      }
    }
  }
  lastSubscribers += 1;
  refreshLibraryNudge();
  hydrateNotificationState().then(refreshLibraryNudge);
  const unsubscribeRemote = subscribeNotificationState(() => refreshLibraryNudge());
  const unsubscribeFeed = subscribeNotifications(() => refreshLibraryNudge());
  return () => {
    unsubscribeRemote();
    unsubscribeFeed();
    listeners.delete(listener);
    lastSubscribers -= 1;
    if (lastSubscribers === 0) {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", onFocusOrVisible);
        if (typeof document !== "undefined") {
          document.removeEventListener("visibilitychange", onFocusOrVisible);
        }
      }
    }
  };
};

export const getLibraryNudgeSnapshot = () => {
  // Keep the server-rendered HTML stable: localStorage and the clock only
  // affect the first client read after hydration.
  if (typeof window === "undefined") return SERVER_SNAPSHOT;
  return snapshot;
};

export const refreshLibraryNudge = () => emit(buildSnapshot());

/** Opening Standouts retires every signal that brought the listener here. */
export const markLibraryNudgeSeen = () => {
  const nudge = nudgeState();
  const signals = { ...acknowledged() };
  const picks = pickFingerprint(publishedContent.picks);
  const highlights = highlightFingerprint(publishedContent.highlights);
  if (picks) signals.picks = picks;
  if (highlights) signals.highlights = highlights;

  const activeWindow = libraryNudgeWindow(new Date(), nudge.windowHour ?? null);
  const keys = activeWindow ? [...seenKeys(), activeWindow.key] : seenKeys();
  setNotificationState({
    nudge: {
      ...nudge,
      signals,
      seenKeys: [...new Set(keys)].slice(-30),
    },
  });
  markStandoutsAnnouncementsRead();
  refreshLibraryNudge();
};

/** A single sub-tab was opened: retire only that sub-tab's badge. */
export const markStandoutsSubTabSeen = (subTab) => {
  if (!["top", "picks", "highlights"].includes(subTab)) return;
  const nudge = nudgeState();
  const signals = { ...acknowledged() };
  if (subTab === "picks") {
    const picks = pickFingerprint(publishedContent.picks);
    if (picks) signals.picks = picks;
  }
  if (subTab === "highlights") {
    const highlights = highlightFingerprint(publishedContent.highlights);
    if (highlights) signals.highlights = highlights;
  }
  setNotificationState({ nudge: { ...nudge, signals } });
  markStandoutsAnnouncementsRead(subTab);
  refreshLibraryNudge();
};

function markStandoutsAnnouncementsRead(subTab = null) {
  const state = getNotificationSnapshot();
  const unread = new Set(state.unreadIds || []);
  for (const item of state.items || []) {
    const id = normalizeNotificationId(item.id);
    if (id === null || !unread.has(id)) continue;
    const target = normalizeNotificationTarget(item.target);
    if (!isStandoutsTarget(target)) continue;
    if (subTab && target !== "standouts" && target !== subTab) continue;
    markNotificationRead(item.id);
  }
}

export const setNudgeMode = (mode) => {
  if (!NUDGE_MODES.includes(mode)) return;
  setNotificationState({ nudge: { ...nudgeState(), mode } });
  refreshLibraryNudge();
};

export const setNudgeWindowHour = (hour) => {
  const value = hour === "auto" ? null : WINDOW_HOURS.includes(Number(hour)) ? Number(hour) : null;
  const nudge = { ...nudgeState() };
  if (value === null) delete nudge.windowHour;
  else nudge.windowHour = value;
  setNotificationState({ nudge });
  refreshLibraryNudge();
};

/** "Remind me later" — quiet for two hours, without losing the signal. */
export const snoozeLibraryNudge = () => {
  const snoozedUntil = new Date(Date.now() + SNOOZE_MS).toISOString();
  setNotificationState({ nudge: { ...nudgeState(), snoozedUntil } });
  refreshLibraryNudge();
};

export const useLibraryNudge = () =>
  useSyncExternalStore(
    subscribeLibraryNudge,
    getLibraryNudgeSnapshot,
    () => SERVER_SNAPSHOT
  );
