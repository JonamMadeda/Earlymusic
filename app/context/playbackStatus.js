"use client";

import { useSyncExternalStore } from "react";

// Live playback state for surfaces outside the Player bar (currently the home
// hero). Keeping this out of PlayerContext matters: time updates fire several
// times a second, and a context value that changes that often would re-render
// every usePlayer() consumer in the tree.
const SERVER_SNAPSHOT = Object.freeze({
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  songId: null,
});

let snapshot = SERVER_SNAPSHOT;
const listeners = new Set();

export const getPlaybackSnapshot = () => snapshot;
export const getPlaybackServerSnapshot = () => SERVER_SNAPSHOT;

export const subscribePlayback = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Merge one or more fields and notify subscribers only when something moved. */
export const reportPlayback = (partial) => {
  if (!partial) return;
  let changed = false;
  const next = { ...snapshot };
  for (const key of Object.keys(partial)) {
    if (Object.is(next[key], partial[key])) continue;
    next[key] = partial[key];
    changed = true;
  }
  if (!changed) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
};

export const usePlaybackStatus = () =>
  useSyncExternalStore(subscribePlayback, getPlaybackSnapshot, getPlaybackServerSnapshot);
