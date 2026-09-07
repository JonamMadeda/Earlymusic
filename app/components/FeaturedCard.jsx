"use client";

import { Play } from "lucide-react";
import SongAvatar from "./SongAvatar";
import { prefetchSongAudio } from "@/lib/prefetchAudio";

const timeWindowDays = 30;

// Vertical card (Used in Fresh Releases / New This Month rails)
const FeaturedCard = ({ song, onClick, isActive }) => {
  const isNew =
    song.created_at &&
    Date.now() - new Date(song.created_at).getTime() <
      timeWindowDays * 24 * 60 * 60 * 1000;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => prefetchSongAudio(song)}
      className={`group relative flex w-[135px] md:w-[155px] flex-shrink-0 snap-start flex-col items-center gap-2.5 rounded-xl p-3 md:p-3.5 text-center transition-all duration-200 hover:-translate-y-0.5 ${
        isActive
          ? "border-2 border-accent bg-neutral-50 shadow-xs"
          : "border border-neutral-200 bg-white hover:border-neutral-400/80 shadow-2xs"
      }`}
    >
      {isActive && (
        <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-accent">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-50" />
        </span>
      )}

      <div className="relative my-0.5">
        <SongAvatar title={song.title} size="lg" variant="mono" />
        <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-md bg-accent text-white shadow opacity-0 scale-75 transition-all duration-150 group-hover:opacity-100 group-hover:scale-100">
          <Play size={10} fill="currentColor" className="ml-0.5" />
        </div>
      </div>

      <div className="w-full min-w-0 px-0.5">
        <div className="flex items-center justify-center gap-1">
          <p className={`truncate text-xs font-semibold tracking-tight ${isActive ? "text-accent" : "text-neutral-900"}`}>
            {song.title}
          </p>
          {isNew && (
            <span className="rounded bg-accent px-1 py-0.5 text-[7px] font-bold uppercase tracking-wider text-white">
              New
            </span>
          )}
        </div>
        <p className="truncate text-[10px] font-medium text-neutral-500 mt-0.5">
          {song.author}
        </p>
      </div>
    </button>
  );
};

export default FeaturedCard;
