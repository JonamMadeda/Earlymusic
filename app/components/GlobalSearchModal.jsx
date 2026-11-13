"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Search, X, Play, Music } from "lucide-react";
import { usePlayer } from "../context/PlayerContext";
import SongAvatar from "./SongAvatar";

export default function GlobalSearchModal({ isOpen, onClose }) {
  const { allSongs, setActiveSong } = usePlayer();
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const timeout = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timeout);
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const filteredSongs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return (allSongs || []).filter(
      (song) =>
        (song.title && song.title.toLowerCase().includes(q)) ||
        (song.author && song.author.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [query, allSongs]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-start justify-center pt-14 px-4 sm:pt-20">
      <div
        className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search songs"
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl animate-fade-in"
      >
        <div className="search-field flex items-center gap-3 border-b border-neutral-100 px-4 py-3.5">
          <Search size={18} className="text-neutral-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search songs and artists"
            placeholder="Search songs, artists..."
            className="flex-1 bg-transparent text-sm md:text-base font-medium text-neutral-900 placeholder:text-neutral-400 outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="rounded-full p-1 text-neutral-400 hover:text-neutral-700 transition"
            >
              <X size={15} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="rounded-lg border border-neutral-200 px-2 py-1 text-xs font-semibold text-neutral-500 hover:bg-neutral-50"
          >
            ESC
          </button>
        </div>

        {/* Stable live region: mounted for the whole session so the count is
            announced as the query changes, unlike a per-branch element. */}
        <p role="status" aria-live="polite" className="sr-only">
          {query.trim() === ""
            ? ""
            : `${filteredSongs.length} ${filteredSongs.length === 1 ? "song" : "songs"} found`}
        </p>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {query.trim() === "" ? (
            <div className="py-10 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
                <Music size={18} />
              </div>
              <p className="text-xs font-semibold text-neutral-600">Quick Song Search</p>
              <p className="mt-0.5 text-xs text-neutral-400">Type a song title or artist to play instantly</p>
            </div>
          ) : filteredSongs.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-xs font-semibold text-neutral-600">No songs found for &ldquo;{query}&rdquo;</p>
              <p className="mt-1 text-xs text-neutral-400">Try searching for a different title or artist</p>
            </div>
          ) : (
            <div className="space-y-1">
              <p
                role="status"
                className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-neutral-400"
              >
                Songs ({filteredSongs.length})
              </p>
              {filteredSongs.map((song) => (
                <button
                  key={song.id}
                  type="button"
                  onClick={() => {
                    setActiveSong(song, allSongs);
                    onClose();
                  }}
                  className="group flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-neutral-50"
                >
                  <SongAvatar title={song.title} size="sm" variant="mono" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-neutral-900 group-hover:text-accent">
                      {song.title}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {song.author}
                    </p>
                  </div>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white opacity-0 shadow-sm transition group-hover:opacity-100 group-focus-within:opacity-100 shrink-0">
                    <Play size={12} fill="currentColor" className="ml-0.5" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
