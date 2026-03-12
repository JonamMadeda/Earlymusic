"use client";

import { useState, useMemo } from "react";
import { Search as SearchIcon, Disc, Music2, Heart, Info } from "lucide-react";
import Loader from "../components/Loader";
import { usePlayer } from "../context/PlayerContext";

const SongResultItem = ({ song, isActive, onClick }) => {
  const [showInfo, setShowInfo] = useState(false);

  const toggleInfo = (e) => {
    e.stopPropagation();
    setShowInfo(!showInfo);
  };

  return (
    <div
      onClick={onClick}
      className="bg-white p-1.5 md:p-2 rounded-2xl flex items-center justify-between group hover:bg-neutral-50 border border-transparent hover:border-neutral-100 transition-all duration-300 cursor-pointer relative"
    >
      <div className="flex items-center gap-x-5 flex-1 min-w-0">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${isActive
            ? "bg-red-600 border-red-600 text-white"
            : "bg-neutral-50 border-neutral-100 text-neutral-400 group-hover:bg-white"
            }`}
        >
          <Music2 size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={`font-semibold text-[15px] leading-tight mb-0.5 tracking-tight transition-colors truncate ${isActive ? "text-red-600" : "text-neutral-900"
              }`}
          >
            {song.title}
          </p>
          <p className="text-[13px] text-neutral-500 font-medium truncate">
            {song.author}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-x-2">
        <button
          onClick={toggleInfo}
          className="p-2 text-neutral-300 hover:text-red-600 transition-colors"
          title="Song Details"
        >
          <Info size={16} />
        </button>
        <button className="w-10 h-10 flex items-center justify-center text-neutral-200 hover:text-red-600 transition-all active:scale-90">
          <Heart size={18} />
        </button>
      </div>

      {showInfo && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-12 top-0 mt-8 z-50 bg-white border border-neutral-100 shadow-xl rounded-2xl p-5 min-w-[240px] animate-in fade-in zoom-in-95 duration-200"
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
    <main className="min-h-[90vh] bg-white pb-40 relative">
      <div className="max-w-5xl mx-auto px-8 py-10">
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
