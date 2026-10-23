"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";


const PlayerContext = createContext();

const RECENT_KEY = "lumbo_recently_played";
const SLEEP_TIMER_KEY = "lumbo_sleep_timer";
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

  // Load from localStorage on mount, then try Supabase for cross-device sync
  useEffect(() => {
    const stored = localStorage.getItem(RECENT_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecentlyPlayed(parsed);
        }
      } catch {
        localStorage.removeItem(RECENT_KEY);
      }
    }
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
    const seededSongs = shuffle(allSongs).slice(0, SEED_COUNT);
    setRecentlyPlayed(seededSongs);
    localStorage.setItem(RECENT_KEY, JSON.stringify(seededSongs));
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
    const token = localStorage.getItem("auth-token");
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    const latest = recentlyPlayed[0];
    if (!latest) return;

    fetch("/api/data/recently_played", {
      method: "POST",
      headers,
      body: JSON.stringify({ song_id: latest.id, played_at: new Date().toISOString() }),
    }).catch((error) => console.error("Unable to sync recently played:", error));

    // Trim to max rows: read the oldest excess entries and delete them by id.
    // (One request per row — the data API matches filters with = only.)
    fetch(`/api/data/recently_played?order=played_at&ascending=false`, {
      headers,
    })
      .then((res) => res.json())
      .then((existing) => {
        if (Array.isArray(existing) && existing.length > MAX_RECENT) {
          const extras = existing.slice(MAX_RECENT);
          extras.forEach((row) => {
            if (!row?.id) return;
            fetch(`/api/data/recently_played?id=${row.id}`, {
              method: "DELETE",
              headers,
            }).catch((error) => console.error("Unable to trim recently played:", error));
          });
        }
      })
      .catch((error) => console.error("Unable to read recently played:", error));
  }, [recentlyPlayed]);

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

  return (
    <PlayerContext.Provider
      value={{
        activeSong,
        setActiveSong,
        allSongs,
        setAllSongs,
        queue,
        isLoading,
        setIsLoading,
        recentlyPlayed,
        playingSource,
        hasRealHistory,
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
