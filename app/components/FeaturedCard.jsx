"use client";

import { Play, Clock } from "lucide-react";
import { initialLetter } from "./SongAvatar";
import { prefetchSongAudio } from "@/lib/prefetchAudio";
import { homepageLengthLabel } from "@/lib/timeFormat";

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

// New song card (Recently Added rail) — centered square letter tile,
// deliberately different from the Spotify card's dark retro artwork.
// Vertical card in a horizontal rail. App palette only.
const FeaturedCard = ({ song, onClick, isActive, isNew = false }) => {
  const letter = initialLetter(song.title);
  const added = timeAgo(song.created_at);
  const length = homepageLengthLabel(song);
  const posture = (song.category || "").trim() || "Worship";

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => prefetchSongAudio(song)}
      aria-current={isActive ? "true" : undefined}
      className={`group relative flex w-[160px] max-w-full md:w-[184px] shrink-0 snap-start flex-col rounded-xl p-3 text-left transition-colors ${
        isActive
          ? "border border-accent bg-neutral-50 ring-1 ring-inset ring-accent"
          : "border border-neutral-200 bg-white hover:border-neutral-400/80 shadow-2xs"
      }`}
    >
      <span className="sr-only">Play: </span>
      {/* Retro Lined Cover Art with Concentric Grooves */}
      <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-lg border border-neutral-300 bg-neutral-100 flex flex-col justify-between p-2.5 shadow-inner">
        {/* Top Tag: Freshness badge */}
        <div className="z-10 flex items-center justify-between">
          <span className="max-w-[75%] truncate rounded border border-neutral-300 bg-white/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-600">
            {added || (isNew ? "New" : "Fresh")}
          </span>
          {!isActive && isNew && (
            <span className="shrink-0 rounded bg-ink px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-none tracking-wider text-white">
              New
            </span>
          )}
        </div>

        {/* Big Crisp Letter Centerpiece */}
        <div className="z-10 flex items-center justify-center py-1">
          <span className="text-3xl font-bold tracking-tight text-accent select-none">
            {letter}
          </span>
        </div>

        {/* Bottom Bar: Duration tag & play trigger */}
        <div className="z-10 flex items-center justify-between">
          {length ? (
            <span className="flex items-center gap-1 rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-neutral-700">
              <Clock size={10} className="text-neutral-500" aria-hidden="true" />
              {length}
            </span>
          ) : <span />}
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white shadow-sm transition-transform group-hover:scale-105">
            <Play size={13} fill="currentColor" className="ml-0.5" />
          </div>
        </div>
      </div>

      {/* Track Info */}
      <div className="w-full min-w-0 px-0.5">
        <p
          title={song.title}
          className={`truncate text-sm font-semibold leading-5 ${isActive ? "text-accent" : "text-neutral-900"}`}
        >
          {song.title}
        </p>
        {/* Session length and spiritual posture outrank redundant single-artist name.
            The artist stays in screen-reader text for accessibility, and the line
            keeps its stable height. */}
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-neutral-500">
          {length && (
            <span className="shrink-0 font-medium tabular-nums text-neutral-600">
              <span className="sr-only">Length: </span>
              {length}
            </span>
          )}
          {length && <span aria-hidden="true" className="text-neutral-300">·</span>}
          <span className="min-w-0 truncate font-medium text-neutral-500">
            {posture}
          </span>
          <span className="sr-only">by {song.author}</span>
        </p>
      </div>
    </button>
  );
};

export default FeaturedCard;
