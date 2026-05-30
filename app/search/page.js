"use client";

import { useState, useMemo } from "react";
import { Search as SearchIcon, Disc, Music, Info, Play } from "lucide-react";
import Loader from "../components/Loader";
import { usePlayer } from "../context/PlayerContext";

const SongResultItem = ({ song, isActive, onClick }) => {
  const [showInfo, setShowInfo] = useState(false);
  const isPraise = song.category?.toLowerCase() === "praise";
  const isNew = song.created_at && (Date.now() - new Date(song.created_at).getTime()) < 14 * 24 * 60 * 60 * 1000;

  return (
    <div
      onClick={onClick}
      className="group relative flex items-center justify-between p-1.5 md:p-2 hover:bg-neutral-50 rounded-2xl transition-all cursor-pointer border border-transparent hover:border-neutral-100"
    >
      <div className="flex items-center gap-x-4 md:gap-x-6 flex-1 min-w-0">
        <div className="w-4 flex items-center justify-center">
          <Play
            className={`transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
            size={16}
            fill={isActive ? "currentColor" : "#dc2626"}
            color={isActive ? "currentColor" : "#dc2626"}
          />
        </div>

        <div className={`h-10 w-10 md:h-11 md:w-11 rounded-xl flex items-center justify-center transition-all border ${isActive
          ? "bg-red-600 border-red-600 text-white shadow-sm"
          : "border-transparent group-hover:bg-white group-hover:shadow-sm bg-neutral-100 group-hover:border-neutral-100"
          }`}
        >
          <Music size={18} className={isActive ? "text-white" : "text-neutral-400"} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-x-2 mb-0.5">
            <p className={`font-semibold text-[15px] leading-tight tracking-tight truncate transition-colors ${isActive ? "text-red-600" : "text-neutral-900"
              }`}
            >
              {song.title}
            </p>
            {isNew && (
              <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider flex-shrink-0">
                NEW
              </span>
            )}
          </div>
          <p className="text-[13px] text-neutral-500 font-medium tracking-normal truncate">
            {song.author}
            <span className="text-neutral-300 mx-1">·</span>
            <span className="text-[11px] text-neutral-400 font-normal">{song.category || "Worship"}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-x-2 pr-2 md:pr-4">
        <button
          onClick={(e) => { e.stopPropagation(); setShowInfo(!showInfo); }}
          className="p-2 text-neutral-300 hover:text-red-600 transition-colors"
          title="Song Details"
        >
          <Info size={16} />
        </button>
      </div>

      {showInfo && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-0 mt-8 z-50 bg-white border border-neutral-100 shadow-xl rounded-2xl p-5 min-w-[240px] animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="flex flex-col gap-y-4">
            <div className="flex items-center justify-between border-b border-neutral-50 pb-2">
              <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Compilation Details</h4>
              <button onClick={() => setShowInfo(false)} className="text-neutral-300 hover:text-red-600 transition">
                <Info size={14} />
              </button>
            </div>

            <div className="flex flex-col gap-y-4 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar text-left">
              {song.original_songs && song.original_songs.length > 0 ? (
                song.original_songs.map((entry, i) => (
                  <div key={i} className="flex flex-col gap-y-1 group/entry">
                    <p className="text-[14px] font-bold text-neutral-900 group-hover/entry:text-red-600 transition-colors leading-tight">
                      {entry.title || "Unknown Title"}
                    </p>
                    <p className="text-[12px] font-medium text-neutral-500">
                      Original Artist: <span className="text-neutral-900">{entry.artist || "Unknown"}</span>
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-[12px] text-neutral-400 italic py-2">No original song details available.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function SearchPage() {
  const [searchValue, setSearchValue] = useState("");

  // Use allSongs (the master database list) to perform the search
  const { activeSong, setActiveSong, allSongs, isLoading } = usePlayer();


  // 1. Filter against the master list (allSongs)
  const filteredResults = useMemo(() => {
    return (allSongs || []).filter(
      (s) =>
        s.title.toLowerCase().includes(searchValue.toLowerCase()) ||
        s.author.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [allSongs, searchValue]);

  // 2. Group for the UI
  const groupedSongs = useMemo(() => {
    return filteredResults.reduce((groups, song) => {
      const letter = song.title[0]?.toUpperCase() || "#";
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(song);
      return groups;
    }, {});
  }, [filteredResults]);

  const alphabet = Object.keys(groupedSongs).sort();

  return (
    <main className="min-h-[90vh] bg-white px-6 py-8 pb-40 relative">
      <div className="max-w-5xl mx-auto">
        {/* SEARCH INPUT */}
        <div className="relative mb-16">
          <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
            <SearchIcon className="text-neutral-400" size={18} />
          </div>
          <input
            type="text"
            placeholder="Search by track or artist..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="w-full bg-neutral-50 border border-neutral-100 py-4 pl-14 pr-8 rounded-2xl text-[15px] font-medium placeholder:text-neutral-300 focus:outline-none focus:border-red-600 focus:bg-white transition-all tracking-tight"
          />
        </div>

        {isLoading ? (
          <Loader />
        ) : alphabet.length > 0 ? (
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
                      <SongResultItem
                        key={song.id}
                        song={song}
                        isActive={activeSong?.id === song.id}
                        onClick={() => setActiveSong(song, filteredResults)}
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mb-4 border border-neutral-100">
              <Disc className="text-neutral-200" size={32} />
            </div>
            <h3 className="text-[13px] font-medium text-neutral-400">
              {searchValue
                ? `No results found for "${searchValue}"`
                : "Search your library"}
            </h3>
          </div>
        )}
      </div>
    </main >
  );
}
