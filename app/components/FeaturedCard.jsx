"use client";

import { Play } from "lucide-react";
import { initialLetter } from "./SongAvatar";
import { prefetchSongAudio } from "@/lib/prefetchAudio";

const timeAgo = (dateStr) => {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (Number.isNaN(diff) || diff < 0) return "";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? "Yesterday" : `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks === 1 ? "1w ago" : `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return months <= 1 ? "1mo ago" : `${months}mo ago`;
};

// Fresh drop card (Fresh Releases rail) — centered + circular,
// deliberately different silhouette from Featured's square covers.
// Vertical card in a horizontal rail. App palette only.
const FeaturedCard = ({ song, onClick, isActive, isNew = false }) => {
  const letter = initialLetter(song.title);
  const added = timeAgo(song.created_at);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => prefetchSongAudio(song)}
      className={`group relative flex w-[140px] md:w-[156px] flex-shrink-0 snap-start flex-col items-center rounded-2xl px-3 pb-3 pt-4 text-center transition-all duration-200 hover:-translate-y-0.5 ${
        isActive
          ? "border-2 border-accent bg-neutral-50 shadow-xs"
          : "border border-neutral-200 bg-white hover:border-neutral-400/70 shadow-2xs"
      }`}
    >
      {/* freshness stamp — matches app meta type */}
      <span className="mb-2 text-[10px] font-medium text-neutral-500">
        {added || (isNew ? "New" : "Fresh")}
      </span>

      {/* circular artwork */}
      <span className="relative block">
        <span
          className={`flex h-16 w-16 items-center justify-center rounded-full border text-2xl font-black select-none transition-colors duration-200 md:h-[72px] md:w-[72px] ${
            isActive
              ? "border-accent bg-accent text-white"
              : "border-accent/15 bg-accent/[0.06] text-accent group-hover:border-accent/30"
          }`}
        >
          {letter}
        </span>
        {isNew && !isActive && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-900 px-1 text-[7px] font-black uppercase tracking-wider text-white ring-2 ring-white">
            N
          </span>
        )}
        {isActive && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 rounded-full bg-accent ring-2 ring-white">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-50" />
          </span>
        )}
        {/* play trigger overlapping the circle */}
        <span
          className={`absolute -bottom-1.5 left-1/2 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full text-white shadow-md ring-2 ring-white transition-all duration-200 ${
            isActive
              ? "bg-accent"
              : "bg-neutral-900 opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100"
          }`}
        >
          {isActive ? (
            <span className="waveform text-white flex h-3 items-end">
              <span /><span /><span /><span />
            </span>
          ) : (
            <Play size={11} fill="currentColor" className="ml-px" />
          )}
        </span>
      </span>

      {/* track info */}
      <span className="mt-3.5 block w-full min-w-0">
        <span className={`block truncate text-xs font-bold tracking-tight ${isActive ? "text-accent" : "text-neutral-900"}`}>
          {song.title}
        </span>
        <span className="mt-0.5 block truncate text-[10px] font-medium text-neutral-500">
          {song.author}
        </span>
      </span>
    </button>
  );
};

export default FeaturedCard;
