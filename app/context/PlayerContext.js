"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

const PlayerContext = createContext();

const RECENT_KEY = "earlymusic_recently_played";
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

  // Seed with random songs for new users (no recently played yet)
  useEffect(() => {
    if (seeded.current) return;
    if (allSongs.length === 0) return;
    if (recentlyPlayed.length > 0) return;

    seeded.current = true;
    const seededSongs = shuffle(allSongs).slice(0, SEED_COUNT);
    setRecentlyPlayed(seededSongs);
    localStorage.setItem(RECENT_KEY, JSON.stringify(seededSongs));

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const rows = seededSongs.map((song, i) => ({
        user_id: user.id,
        song_id: song.id,
        created_at: new Date(Date.now() - (SEED_COUNT - i) * 60000).toISOString(),
      }));
      supabase
        .from("recently_played")
        .upsert(rows, { onConflict: "user_id, song_id", ignoreDuplicates: true })
        .select()
        .then(() => {})
        .catch((error) => console.error("Unable to seed recently played:", error));
    }).catch((error) => console.error("Unable to get user for seeding:", error));
  }, [allSongs, recentlyPlayed]);

  // Sync recently played changes to Supabase (only the latest play)
  useEffect(() => {
    if (recentlyPlayed.length === 0) return;

    localStorage.setItem(RECENT_KEY, JSON.stringify(recentlyPlayed));

    const prev = prevRecentRef.current;
    prevRecentRef.current = recentlyPlayed;

    // Skip the baseline value loaded during hydration and pure reorders/seeds —
    // only a new play at the front of the list is written to the database.
    if (prev === null) return;
    if (recentlyPlayed[0]?.id === prev[0]?.id) return;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      const latest = recentlyPlayed[0];
      if (!latest) return;

      supabase
        .from("recently_played")
        .upsert(
          { user_id: user.id, song_id: latest.id, created_at: new Date().toISOString() },
          { onConflict: "user_id, song_id" }
        )
        .select()
        .then(() => {})
        .catch((error) => console.error("Unable to sync recently played:", error));

      // Trim to max rows
      supabase
        .from("recently_played")
        .select("id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .then(({ data: existing }) => {
          if (existing && existing.length > MAX_RECENT) {
            const idsToDelete = existing.slice(MAX_RECENT).map((r) => r.id);
            supabase
              .from("recently_played")
              .delete()
              .in("id", idsToDelete)
              .select()
              .then(() => {})
              .catch((error) => console.error("Unable to trim recently played:", error));
          }
        })
        .catch((error) => console.error("Unable to read recently played:", error));
    }).catch((error) => console.error("Unable to get user for sync:", error));
  }, [recentlyPlayed]);

  const setActiveSong = useCallback(
    (song, customQueue = null) => {
      setActiveSongState(song);
      setQueue(customQueue || allSongs);
      if (song) {
        setRecentlyPlayed((prev) => {
          const filtered = prev.filter((s) => s.id !== song.id);
          return [song, ...filtered].slice(0, MAX_RECENT);
        });
      }
    },
    [allSongs]
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
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => useContext(PlayerContext);
