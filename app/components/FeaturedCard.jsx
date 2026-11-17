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
      aria-current={isActive ? "true" : undefined}
      className={`group relative flex w-[152px] max-w-full shrink-0 snap-start flex-col items-center rounded-xl border px-3 pb-4 pt-4 text-center transition-colors md:w-[168px] ${
        isActive
          ? "border-accent bg-neutral-50 ring-1 ring-inset ring-accent"
          : "border-neutral-200 bg-white hover:border-neutral-400/70"
      }`}
    >
      <span className="sr-only">Play: </span>
      {/* freshness stamp — matches app meta type */}
      <span className="mb-2.5 text-xs font-medium leading-4 text-neutral-500">
        {added || (isNew ? "New" : "Fresh")}
      </span>

      {/* circular artwork */}
      <span className="relative block">
        <span
          className={`flex h-16 w-16 items-center justify-center rounded-md border text-2xl font-black select-none transition-colors duration-200 md:h-[72px] md:w-[72px] ${
            isActive
              ? "border-accent bg-accent text-white"
              : "border-accent/15 bg-accent/[0.06] text-accent group-hover:border-accent/30"
          }`}
        >
          {letter}
        </span>
        {isActive && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 rounded-md bg-accent ring-2 ring-white">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-md bg-accent opacity-50" />
          </span>
        )}
        {/* Keep the new badge visible while the track is playing too; it sits
            above the pulsing active dot so the "N" text never disappears. */}
        {isNew && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-md bg-gold px-1 text-[10px] font-normal uppercase tracking-wider text-white ring-2 ring-white">
            N
          </span>
        )}
        {/* play trigger overlapping the circle */}
        <span
          className={`absolute -bottom-1.5 left-1/2 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-lg text-white shadow-md ring-2 ring-white transition-all duration-200 ${
            isActive
              ? "bg-accent"
              : "bg-neutral-900"
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
      <span className="mt-5 block w-full min-w-0">
        <span className={`block truncate text-sm font-semibold leading-5 ${isActive ? "text-accent" : "text-neutral-900"}`}>
          {song.title}
        </span>
        <span className="mt-1 block truncate text-xs font-medium leading-4 text-neutral-500">
          {song.author}
        </span>
      </span>
    </button>
  );
};

export default FeaturedCard;
