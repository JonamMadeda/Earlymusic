"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import SongAvatar from "./SongAvatar";

/**
 * Searchable song picker used by Library → Picks.
 * Rendered only while a period is being edited, so the catalogue is already
 * in memory and no extra request is needed.
 */
export default function PickSongDialog({
  open,
  heading = "Choose a song",
  songs = [],
  saving = false,
  selectedSongId = null,
  onSelect,
  onClose,
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return songs;
    return songs.filter(
      (song) =>
        (song.title || "").toLowerCase().includes(needle) ||
        (song.author || "").toLowerCase().includes(needle)
    );
  }, [songs, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-neutral-900/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pick-song-title"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-neutral-200 bg-white shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              Your picks
            </p>
            <h2 id="pick-song-title" className="mt-0.5 text-sm font-bold tracking-tight text-neutral-900">
              {heading}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close song picker"
            className="tap-sm flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
          >
            <X size={15} />
          </button>
        </div>

        <div className="border-b border-neutral-100 px-4 py-3">
          <div className="search-field flex h-10 items-center gap-2 rounded-xl border border-neutral-200/80 bg-neutral-50 px-3 text-neutral-500 transition focus-within:border-neutral-300 focus-within:bg-white">
            <Search size={14} className="shrink-0 text-neutral-400" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search songs or artists…"
              aria-label="Search songs to pick"
              autoComplete="off"
              autoFocus
              className="w-full min-w-0 bg-transparent text-sm font-medium text-neutral-900 outline-none placeholder:text-neutral-400"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="tap-sm flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-200"
              >
                <X size={11} strokeWidth={3} />
              </button>
            )}
          </div>
          <p className="mt-2 text-[11px] font-medium text-neutral-400">
            {filtered.length} {filtered.length === 1 ? "song" : "songs"}
          </p>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm font-semibold text-neutral-900">No matching songs</p>
              <p className="mt-1 text-xs text-neutral-500">
                Try a different title or artist.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {filtered.map((song) => {
                const isSelected = String(selectedSongId ?? "") === String(song.id);
                return (
                  <button
                    key={song.id}
                    type="button"
                    disabled={saving}
                    onClick={() => onSelect?.(song)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-neutral-50 disabled:opacity-60"
                  >
                    <SongAvatar title={song.title} size="row" variant="mono" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold tracking-tight text-neutral-900">
                        {song.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs font-medium text-neutral-400">
                        {song.author}
                      </span>
                    </span>
                    {isSelected && (
                      <Check size={15} className="shrink-0 text-accent" strokeWidth={3} />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
