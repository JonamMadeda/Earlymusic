"use client";

import { useState, useEffect, useMemo } from "react";
import SongItem from "../components/SongItem";
import Loader from "../components/Loader";
import { usePlayer } from "../context/PlayerContext";
import { Library as LibraryIcon, HeartOff } from "lucide-react";

export default function LibraryPage() {
  const [librarySongs, setLibrarySongs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { setActiveSong } = usePlayer();

  const fetchLibrary = () => {
    if (typeof window !== "undefined") {
      try {
        const saved = JSON.parse(
          localStorage.getItem("earlymusic_library") || "[]"
        );
        setLibrarySongs(saved);
      } catch (error) {
        console.error("Error loading library:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchLibrary();
    window.addEventListener("libraryUpdated", fetchLibrary);
    return () => window.removeEventListener("libraryUpdated", fetchLibrary);
  }, []);

  const groupedSongs = useMemo(() => {
    const sorted = [...librarySongs].sort((a, b) =>
      a.title.localeCompare(b.title)
    );

    return sorted.reduce((groups, song) => {
      const letter = song.title[0]?.toUpperCase() || "#";
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(song);
      return groups;
    }, {});
  }, [librarySongs]);

  const alphabet = Object.keys(groupedSongs).sort();

  return (
    <main className="min-h-[90vh] bg-white px-6 py-8 pb-40 relative">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-x-3 mb-12 px-2">
          <LibraryIcon className="text-red-600" size={24} />
          <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">
            Library
          </h1>
        </div>

        {isLoading ? (
          <Loader />
        ) : librarySongs.length > 0 ? (
          <div className="flex flex-col gap-y-6">
            {alphabet.map((letter) => (
              <div key={letter} className="flex flex-col gap-y-2">
                <div className="flex items-center gap-x-4 border-b border-neutral-50 pb-2 px-2">
                  <h2 className="text-3xl font-semibold text-neutral-900 tracking-tight">
                    {letter}
                  </h2>
                </div>

                <div className="flex flex-col gap-y-1">
                  {groupedSongs[letter].map((song) => (
                    <SongItem
                      key={song.id}
                      song={song}
                      // PASS THE LIBRARY LIST HERE
                      onClick={() => setActiveSong(song, librarySongs)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <HeartOff className="text-neutral-200 mb-4" size={32} />
            <p className="text-[15px] font-medium text-neutral-900">
              Your library is empty
            </p>
            <p className="text-[13px] text-neutral-400 mt-1">
              Songs you heart will appear here.
            </p>
          </div>
        )
        }
      </div >
    </main >
  );
}
