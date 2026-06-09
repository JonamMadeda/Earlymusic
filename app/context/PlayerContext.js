"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";

const PlayerContext = createContext();

export const PlayerProvider = ({ children }) => {
  const [activeSong, setActiveSongState] = useState(null);
  const [allSongs, setAllSongs] = useState([]);
  const [queue, setQueue] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [recentlyPlayed, setRecentlyPlayed] = useState([]);

  useEffect(() => {
    const stored = localStorage.getItem("earlymusic_recently_played");
    if (stored) {
      try {
        setRecentlyPlayed(JSON.parse(stored));
      } catch {}
    }
  }, []);

  const setActiveSong = useCallback(
    (song, customQueue = null) => {
      setActiveSongState(song);
      setQueue(customQueue || allSongs);

      if (song) {
        setRecentlyPlayed((prev) => {
          const filtered = prev.filter((s) => s.id !== song.id);
          const updated = [song, ...filtered].slice(0, 10);
          localStorage.setItem("earlymusic_recently_played", JSON.stringify(updated));
          return updated;
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
