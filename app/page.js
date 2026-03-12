"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { usePlayer } from "./context/PlayerContext";
import Loader from "./components/Loader";
import SongItem from "./components/SongItem";

export default function Home() {
  const { allSongs, setAllSongs, setActiveSong, isLoading, setIsLoading } =
    usePlayer();
  const [activeFilter, setActiveFilter] = useState("All");
  const [activeCategory, setActiveCategory] = useState("All");

  const filters = [
    { label: "All", days: null },
    { label: "1 Month", days: 30 },
    { label: "3 Months", days: 90 },
    { label: "1 Year", days: 365 },
  ];

  useEffect(() => {
    const fetchSongs = async () => {
      try {
        if (allSongs.length > 0) {
          setIsLoading(false);
          return;
        }

        setIsLoading(true);

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

  const filteredSongs = useMemo(() => {
    let result = allSongs || [];

    // Apply Time Filter
    if (activeFilter !== "All") {
      const filterObj = filters.find((f) => f.label === activeFilter);
      if (filterObj && filterObj.days) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - filterObj.days);
        result = result.filter((song) => new Date(song.created_at) >= cutoff);
      }
    }

    // Apply Category Filter
    if (activeCategory !== "All") {
      result = result.filter((song) => {
        const songCategory = (song.category || "Worship").trim().toLowerCase();
        return songCategory === activeCategory.trim().toLowerCase();
      });
    }

    return result;
  }, [allSongs, activeFilter, activeCategory]);

  const groupedSongs = useMemo(() => {
    return (filteredSongs || []).reduce((groups, song) => {
      const letter = song.title[0]?.toUpperCase() || "#";
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(song);
      return groups;
    }, {});
  }, [filteredSongs]);

  const alphabet = Object.keys(groupedSongs).sort();

  return (
    <main className="min-h-[90vh] bg-white px-6 py-8 pb-40 relative">
      <div className="max-w-5xl mx-auto">
        {/* Consolidated Filters */}
        <div className="flex items-center gap-2 md:gap-4 mb-8 md:mb-12 overflow-x-auto no-scrollbar py-2">
          {/* Time Picker */}
          <div className="flex items-center gap-x-2 md:gap-x-3 bg-neutral-50 px-3 py-2 md:px-4 md:py-2.5 rounded-2xl border border-neutral-100/50 flex-shrink-0">
            <span className="text-[10px] md:text-[11px] font-medium text-neutral-400">
              Time
            </span>
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className="bg-transparent text-[12px] md:text-[13px] font-bold text-neutral-900 outline-none cursor-pointer pr-1"
            >
              {filters.map((f) => (
                <option key={f.label} value={f.label}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Category Picker */}
          <div className="flex items-center gap-x-2 md:gap-x-3 bg-neutral-50 px-3 py-2 md:px-4 md:py-2.5 rounded-2xl border border-neutral-100/50 flex-shrink-0">
            <span className="text-[10px] md:text-[11px] font-medium text-neutral-400">
              Type
            </span>
            <select
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value)}
              className="bg-transparent text-[12px] md:text-[13px] font-bold text-neutral-900 outline-none cursor-pointer pr-1"
            >
              {["All", "Worship", "Praise"].map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Active Status Indicators */}
          {(activeFilter !== "All" || activeCategory !== "All") && (
            <button
              onClick={() => {
                setActiveFilter("All");
                setActiveCategory("All");
              }}
              className="ml-auto flex-shrink-0 text-red-600 text-[10px] md:text-[11px] font-bold uppercase tracking-widest hover:underline"
            >
              Reset
            </button>
          )}
        </div>

        {isLoading ? (
          <Loader />
        ) : (
          <div className="flex flex-col gap-y-6">
            {alphabet.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
                <p className="text-sm font-medium">No songs found for this timeframe</p>
              </div>
            ) : (
              alphabet.map((letter) => (
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
                        onClick={() => setActiveSong(song, filteredSongs)}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </main>
  );
}
