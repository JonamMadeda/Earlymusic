"use client";

import { useSyncExternalStore } from "react";

// A small, time-boxed nudge for the Library's Spotlight view. It should feel
// like "there is something new here", not a permanent badge, so it only shows
// inside short daily windows and only until the listener has opened Spotlight.
const STORAGE_KEY = "luumbo_library_spotlight_nudge";
const WINDOW_HOURS = [7, 12, 18];
const WINDOW_MINUTES = 45;
const SERVER_SNAPSHOT = Object.freeze({
  active: false,
  windowLabel: "",
  windowKey: "",
});

const localDayKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/**
 * Which daily window (if any) the supplied time falls in. One of breakfast,
 * lunch or evening is picked per calendar day, so the dot is time-boxed and
 * appears at most once a day (less if the listener opens Spotlight).
 */
export function libraryNudgeWindow(date = new Date()) {
  const scheduledHour = WINDOW_HOURS[date.getDate() % WINDOW_HOURS.length];
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

function readSeenWindow() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function buildSnapshot(date = new Date()) {
  const activeWindow = libraryNudgeWindow(date);
  if (!activeWindow) return SERVER_SNAPSHOT;
  const seenWindow = readSeenWindow();
  if (seenWindow === activeWindow.key) return SERVER_SNAPSHOT;
  return {
    active: true,
    windowLabel: activeWindow.label,
    windowKey: activeWindow.key,
  };
}

let snapshot = SERVER_SNAPSHOT;
let timer = null;
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

export const subscribeLibraryNudge = (listener) => {
  listeners.add(listener);
  ensureTimer();
  refreshLibraryNudge();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      window.clearInterval(timer);
      timer = null;
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

/** Opened Spotlight: retire the dot for the rest of this daily window. */
export const markLibraryNudgeSeen = () => {
  const current = buildSnapshot();
  if (!current.active) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, current.windowKey);
  } catch {
    // Private-mode storage failures only cost the once-per-window dismissal.
  }
  emit(SERVER_SNAPSHOT);
};

export const useLibraryNudge = () =>
  useSyncExternalStore(
    subscribeLibraryNudge,
    getLibraryNudgeSnapshot,
    () => SERVER_SNAPSHOT
  );
