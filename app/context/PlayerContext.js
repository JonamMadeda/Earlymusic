"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";


const PlayerContext = createContext();

const RECENT_KEY = "lumbo_recently_played";
const SLEEP_TIMER_KEY = "lumbo_sleep_timer";
const PLAYER_SETTINGS_KEY = "lumbo_player_settings";
const REPEAT_MODES = ["off", "all", "one"];
export const PLAYBACK_POSITION_KEY = "lumbo_playback_position";
const MAX_RECENT = 10;
const SEED_COUNT = 6;

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const PlayerProvider = ({ children }) => {
  const [activeSong, setActiveSongState] = useState(null);
  const [allSongs, setAllSongs] = useState([]);
  const [queue, setQueue] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [recentlyPlayed, setRecentlyPlayed] = useState([]);
  const [playingSource, setPlayingSource] = useState("library");
  const [sleepTimerEnd, setSleepTimerEnd] = useState(null);
  const [sleepTimerDuration, setSleepTimerDuration] = useState(0);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState(0);
  const [sleepTimerStopSignal, setSleepTimerStopSignal] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState("off");
  // True once the user has genuinely played something (seeded suggestions
  // for new users don't count — see the seed effect below).
  const [hasRealHistory, setHasRealHistory] = useState(() => {
    try {
      return localStorage.getItem("lumbo_has_played") === "1";
    } catch {
      return false;
    }
  });
  const seeded = useRef(false);
  const prevRecentRef = useRef(null);
  const settingsRestoredRef = useRef(false);

  // Load local history after hydration without a synchronous state cascade.
  useEffect(() => {
    const timeout = setTimeout(() => {
      const stored = localStorage.getItem(RECENT_KEY);
      if (!stored) return;
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecentlyPlayed(parsed);
        }
      } catch {
        localStorage.removeItem(RECENT_KEY);
      }
    }, 0);
    return () => clearTimeout(timeout);
  }, []);

  // PlayerWrapper only mounts <Player> once activeSong is set, and it is
  // <Player> that seeks to the stored position — so a reload has to seed the
  // song here first or resume never happens.
  useEffect(() => {
    const timeout = setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(PLAYBACK_POSITION_KEY) || "null");
        if (saved?.song?.id && saved.song.song_path && saved.position > 5) {
          setActiveSongState(saved.song);
        }
      } catch {}
    }, 0);
    return () => clearTimeout(timeout);
  }, []);

  // Signing out must drop the previous listener's history in this tab too.
  useEffect(() => {
    const onSignedOut = () => {
      setRecentlyPlayed([]);
      setHasRealHistory(false);
      try {
        localStorage.removeItem(RECENT_KEY);
        localStorage.removeItem("lumbo_has_played");
        // Without this the resume effect below would hand the next listener
        // in this tab the previous account's half-played track.
        localStorage.removeItem(PLAYBACK_POSITION_KEY);
      } catch {}
    };
    window.addEventListener("auth:signed-out", onSignedOut);
    return () => window.removeEventListener("auth:signed-out", onSignedOut);
  }, []);

  // Restore a sleep timer that was set before the app was closed/reloaded.
  // Deferred a tick so hydration isn't immediately followed by a state flush.
  useEffect(() => {
    const restore = () => {
      try {
        const stored = localStorage.getItem(SLEEP_TIMER_KEY);
        if (!stored) return;

        const parsed = JSON.parse(stored);
        const end = Number(parsed?.end);
        const minutes = Number(parsed?.minutes);

        if (end > Date.now() && minutes > 0) {
          setSleepTimerEnd(end);
          setSleepTimerDuration(minutes);
          setSleepTimerRemaining(end - Date.now());
        } else {
          localStorage.removeItem(SLEEP_TIMER_KEY);
        }
      } catch {
        localStorage.removeItem(SLEEP_TIMER_KEY);
      }
    };

    const timeoutId = setTimeout(restore, 0);
    return () => clearTimeout(timeoutId);
  }, []);

  // Restore device player settings after hydration, deferred a tick like the
  // sleep-timer restore above to avoid a synchronous state cascade.
  useEffect(() => {
    const timeout = setTimeout(() => {
      try {
        const stored = localStorage.getItem(PLAYER_SETTINGS_KEY);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (typeof parsed?.volume === "number" && Number.isFinite(parsed.volume)) {
              setVolume(Math.min(1, Math.max(0, parsed.volume)));
            }
            if (typeof parsed?.isMuted === "boolean") setIsMuted(parsed.isMuted);
            if (typeof parsed?.isShuffle === "boolean") setIsShuffle(parsed.isShuffle);
            if (REPEAT_MODES.includes(parsed?.repeatMode)) setRepeatMode(parsed.repeatMode);
          } catch {
            localStorage.removeItem(PLAYER_SETTINGS_KEY);
          }
        }
      } catch {}
      settingsRestoredRef.current = true;
    }, 0);
    return () => clearTimeout(timeout);
  }, []);

  // Persist settings, but only after the deferred restore has run — otherwise
  // the mount-time defaults would clobber whatever was stored last session.
  useEffect(() => {
    if (!settingsRestoredRef.current) return;
    try {
      localStorage.setItem(
        PLAYER_SETTINGS_KEY,
        JSON.stringify({ volume, isMuted, isShuffle, repeatMode })
      );
    } catch {}
  }, [volume, isMuted, isShuffle, repeatMode]);

  // Tick the sleep timer down and fire a stop signal when it expires.
  useEffect(() => {
    if (!sleepTimerEnd) return;

    let intervalId = null;

    const expire = () => {
      if (intervalId) clearInterval(intervalId);
      setSleepTimerEnd(null);
      setSleepTimerDuration(0);
      setSleepTimerRemaining(0);
      try {
        localStorage.removeItem(SLEEP_TIMER_KEY);
      } catch {}
      setSleepTimerStopSignal((count) => count + 1);
    };

    const tick = () => {
      const remaining = sleepTimerEnd - Date.now();
      if (remaining <= 0) {
        expire();
        return;
      }
      setSleepTimerRemaining(remaining);
    };

    tick();
    intervalId = setInterval(tick, 1000);

    // Background timers can be throttled. Re-check as soon as the app is
    // visible again so an overdue timer stops playback immediately.
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [sleepTimerEnd]);

  const setSleepTimer = useCallback((minutes) => {
    if (!minutes || minutes <= 0) {
      setSleepTimerEnd(null);
      setSleepTimerDuration(0);
      setSleepTimerRemaining(0);
      try {
        localStorage.removeItem(SLEEP_TIMER_KEY);
      } catch {}
      return;
    }

    const end = Date.now() + minutes * 60 * 1000;
    setSleepTimerEnd(end);
    setSleepTimerDuration(minutes);
    setSleepTimerRemaining(minutes * 60 * 1000);
    try {
      localStorage.setItem(SLEEP_TIMER_KEY, JSON.stringify({ end, minutes }));
    } catch {}
  }, []);

  const cancelSleepTimer = useCallback(() => {
    setSleepTimerEnd(null);
    setSleepTimerDuration(0);
    setSleepTimerRemaining(0);
    try {
      localStorage.removeItem(SLEEP_TIMER_KEY);
    } catch {}
  }, []);

  // Seed with random songs for new users (no recently played yet).
  // Local-only: these are suggestions, not real plays, so they must never
  // be written to the listening-history table.
  useEffect(() => {
    if (seeded.current) return;
    if (allSongs.length === 0) return;
    if (recentlyPlayed.length > 0) return;

    seeded.current = true;
    const timeout = setTimeout(() => {
      const seededSongs = shuffle(allSongs).slice(0, SEED_COUNT);
      setRecentlyPlayed(seededSongs);
      localStorage.setItem(RECENT_KEY, JSON.stringify(seededSongs));
    }, 0);
    return () => clearTimeout(timeout);
  }, [allSongs, recentlyPlayed]);

  // Sync recently played changes to the database (only the latest play).
  // NOTE: the table's timestamp column is played_at (not created_at).
  useEffect(() => {
    if (recentlyPlayed.length === 0) return;

    localStorage.setItem(RECENT_KEY, JSON.stringify(recentlyPlayed));

    const prev = prevRecentRef.current;
    prevRecentRef.current = recentlyPlayed;

    // Skip the baseline value loaded during hydration and pure reorders/seeds —
    // only a new play at the front of the list is written to the database.
    if (prev === null) return;
    if (recentlyPlayed[0]?.id === prev[0]?.id) return;

    // Never sync seeded suggestions — only songs the user actually played.
    // A seeded entry is any baseline item that was never at the front due to
    // a real play; the guard above already ensures a genuine new play.
    const headers = { "Content-Type": "application/json" };

    const latest = recentlyPlayed[0];
    if (!latest) return;

    fetch("/api/data/recently_played", {
      method: "POST",
      credentials: "same-origin",
      headers,
      body: JSON.stringify({ song_id: latest.id, played_at: new Date().toISOString() }),
    }).catch((error) => console.error("Unable to sync recently played:", error));

    // Trim to max rows: read the oldest excess entries and delete them by id.
    // (One request per row — the data API matches filters with = only.)
    fetch(`/api/data/recently_played?order=played_at&ascending=false`, {
      credentials: "same-origin",
      headers,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((existing) => {
        if (Array.isArray(existing) && existing.length > MAX_RECENT) {
          const extras = existing.slice(MAX_RECENT);
          extras.forEach((row) => {
            if (!row?.id) return;
            fetch(`/api/data/recently_played?id=${row.id}`, {
              method: "DELETE",
              credentials: "same-origin",
              headers,
            }).catch((error) => console.error("Unable to trim recently played:", error));
          });
        }
      })
      .catch((error) => console.error("Unable to read recently played:", error));
  }, [recentlyPlayed]);

  const restorePlayback = useCallback((song, savedQueue = []) => {
    if (!song) return;
    setActiveSongState(song);
    setQueue(savedQueue.length > 0 ? savedQueue : [song]);
    setPlayingSource("library");
  }, []);

  const setActiveSong = useCallback(
    (song, customQueue = null) => {
      setActiveSongState(song);
      const newQueue = customQueue || allSongs;
      setQueue(newQueue);
      if (song) {
        setHasRealHistory(true);
        try {
          localStorage.setItem("lumbo_has_played", "1");
        } catch {}
        setRecentlyPlayed((prev) => {
          const filtered = prev.filter((s) => s.id !== song.id);
          return [song, ...filtered].slice(0, MAX_RECENT);
        });
        if (newQueue === allSongs) {
          setPlayingSource("library");
        } else if (customQueue && customQueue.length <= 10) {
          const first = customQueue[0];
          if (first && recentlyPlayed.some((s) => s.id === first.id)) {
            setPlayingSource("recently played");
          } else {
            setPlayingSource("playlist");
          }
        } else {
          setPlayingSource("collection");
        }
      }
    },
    [allSongs, recentlyPlayed]
  );

  const addToQueueNext = useCallback(
    (song) => {
      if (!song) return;
      setQueue((prev) => {
        const activeIndex = activeSong
          ? prev.findIndex((s) => s.id === activeSong.id)
          : -1;
        const insertAt = activeIndex === -1 ? 0 : activeIndex + 1;
        // De-duplicate by id; adjust for a copy removed before the insert point.
        const removedBefore = prev
          .slice(0, insertAt)
          .filter((s) => s.id === song.id).length;
        const next = prev.filter((s) => s.id !== song.id);
        next.splice(insertAt - removedBefore, 0, song);
        return next;
      });
    },
    [activeSong]
  );

  const removeFromQueue = useCallback((songId) => {
    setQueue((prev) => prev.filter((s) => s.id !== songId));
  }, []);

  const clearQueue = useCallback(() => {
    // Player falls back to the whole library when the queue is empty, so keep
    // the active song to mean "nothing up next" without stopping playback.
    setQueue(activeSong ? [activeSong] : []);
  }, [activeSong]);

  const moveInQueue = useCallback((fromIndex, toIndex) => {
    setQueue((prev) => {
      if (
        !Number.isInteger(fromIndex) ||
        !Number.isInteger(toIndex) ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex >= prev.length ||
        fromIndex === toIndex
      ) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        activeSong,
        setActiveSong,
        restorePlayback,
        allSongs,
        setAllSongs,
        queue,
        addToQueueNext,
        removeFromQueue,
        clearQueue,
        moveInQueue,
        isLoading,
        setIsLoading,
        recentlyPlayed,
        playingSource,
        hasRealHistory,
        volume,
        setVolume,
        isMuted,
        setIsMuted,
        isShuffle,
        setIsShuffle,
        repeatMode,
        setRepeatMode,
        sleepTimerEnd,
        sleepTimerDuration,
        sleepTimerRemaining,
        sleepTimerStopSignal,
        setSleepTimer,
        cancelSleepTimer,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => useContext(PlayerContext);
