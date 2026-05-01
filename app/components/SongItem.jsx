"use client";

import { useState, useEffect } from "react";
import { Play, Music, Heart, Info } from "lucide-react";

const SongItem = ({ song, onClick }) => {
  const isPraise = song.category?.toLowerCase() === "praise";
  const [isSaved, setIsSaved] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    const library = JSON.parse(
      localStorage.getItem("earlymusic_library") || "[]"
    );
    setIsSaved(library.some((s) => s.id === song.id));
  }, [song.id]);

  const toggleSave = (e) => {
    e.stopPropagation();
    const library = JSON.parse(
      localStorage.getItem("earlymusic_library") || "[]"
    );
    let updatedLibrary;

    if (isSaved) {
      updatedLibrary = library.filter((s) => s.id !== song.id);
    } else {
      updatedLibrary = [song, ...library];
    }

    localStorage.setItem("earlymusic_library", JSON.stringify(updatedLibrary));
    setIsSaved(!isSaved);
    window.dispatchEvent(new Event("libraryUpdated"));
  };

  const toggleInfo = (e) => {
    e.stopPropagation();
    setShowInfo(!showInfo);
  };

  return (
    <div
      onClick={onClick}
      className="group relative flex items-center justify-between p-1.5 md:p-2 hover:bg-neutral-50 rounded-2xl transition-all cursor-pointer border border-transparent hover:border-neutral-100"
    >
      <div className="flex items-center gap-x-4 md:gap-x-6 flex-1 min-w-0">
        {/* Simple Play Indicator */}
        <div className="w-4 flex items-center justify-center">
          <Play
            className="text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
            size={16}
            fill="currentColor"
          />
        </div>

        {/* Music Square */}
        <div className={`h-10 w-10 md:h-11 md:w-11 rounded-xl flex items-center justify-center transition-all border border-transparent group-hover:bg-white group-hover:shadow-sm ${isPraise
          ? "bg-red-50 group-hover:border-red-100"
          : "bg-neutral-100 group-hover:border-neutral-100"
          }`}>
          <Music className={isPraise ? "text-red-400" : "text-neutral-400"} size={18} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-x-2 mb-0.5">
            <p className="font-semibold text-neutral-900 text-[15px] leading-tight tracking-tight truncate">
              {song.title}
            </p>
          </div>
          <p className="text-[13px] text-neutral-500 font-medium tracking-normal truncate">
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
          <Info size={18} />
        </button>

        <button
          onClick={toggleSave}
          className={`pr-2 md:pr-4 transition-transform active:scale-90 ${isSaved ? "opacity-100" : "opacity-30 group-hover:opacity-100"
            }`}
        >
          <Heart
            size={20}
            className={
              isSaved
                ? "text-red-600 fill-red-600"
                : "text-neutral-300 hover:text-red-400 transition-colors"
            }
          />
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

            <div className="flex flex-col gap-y-4 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
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

export default SongItem;
