"use client";

import { useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { usePlayer } from "./context/PlayerContext";
import Loader from "./components/Loader";
import SongItem from "./components/SongItem";

export default function Home() {
  const { allSongs, setAllSongs, setActiveSong, isLoading, setIsLoading } =
    usePlayer();

  useEffect(() => {
    const fetchSongs = async () => {
      try {
        if (allSongs.length > 0) {
          setIsLoading(false);
          return;
        }

        setIsLoading(true);

        // Try to load cached songs from localStorage first
        const cachedSongs = localStorage.getItem("earlymusic_songs_cache");
        if (cachedSongs) {
          setAllSongs(JSON.parse(cachedSongs));
          setIsLoading(false);
        }

        const { data, error } = await supabase
          .from("songs")
          .select("*")
          .order("title", { ascending: true });

        if (data) {
          setAllSongs(data);
          localStorage.setItem("earlymusic_songs_cache", JSON.stringify(data));
        } else if (error && !cachedSongs) {
          console.error("Fetch error and no cache:", error);
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSongs();
  }, [allSongs, setAllSongs, setIsLoading]);

  const groupedSongs = useMemo(() => {
    return (allSongs || []).reduce((groups, song) => {
      const letter = song.title[0]?.toUpperCase() || "#";
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(song);
      return groups;
    }, {});
  }, [allSongs]);

  const alphabet = Object.keys(groupedSongs).sort();

  return (
    /* FIXED: Removed the 'mt' margin since we aren't using fixed anymore.
       Added 'relative' to ensure the sticky header in the parent layout 
       knows where to anchor.
    */
    <main className="min-h-[90vh] bg-white px-6 py-8 pb-40 relative">
      <div className="max-w-5xl mx-auto">
        {isLoading ? (
          <Loader />
        ) : (
          <div className="flex flex-col gap-y-10">
            {alphabet.map((letter) => (
              <div key={letter} className="flex flex-col gap-y-4">
                <div className="flex items-center gap-x-4 border-b border-neutral-50 pb-3 px-2">
                  <h2 className="text-3xl font-semibold text-red-600 tracking-tight">
                    {letter}
                  </h2>
                </div>
                <div className="flex flex-col gap-y-1">
                  {groupedSongs[letter].map((song) => (
                    <SongItem
                      key={song.id}
                      song={song}
                      onClick={() => setActiveSong(song, allSongs)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
