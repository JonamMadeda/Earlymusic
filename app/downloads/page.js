"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, Music, Play, Trash2, Disc, HardDrive } from "lucide-react";
import { usePlayer } from "@/app/context/PlayerContext";
import {
  getDownloadedSongs,
  removeDownload,
  getStorageEstimate,
} from "@/lib/downloadManager";

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

export default function DownloadsPage() {
  const { allSongs, setActiveSong } = usePlayer();
  const [downloadedSongs, setDownloadedSongs] = useState([]);
  const [storage, setStorage] = useState(null);

  const refresh = useCallback(() => {
    setDownloadedSongs(getDownloadedSongs());
    getStorageEstimate().then(setStorage);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleRemove = async (e, songId) => {
    e.stopPropagation();
    await removeDownload(songId);
    refresh();
  };

  const handlePlay = (songId) => {
    const song = allSongs.find((s) => s.id === songId);
    if (song) setActiveSong(song, allSongs);
  };

  const storagePercent = storage && storage.quota > 0
    ? Math.min((storage.usage / storage.quota) * 100, 100)
    : 0;
  const isFull = storagePercent >= 95;

  return (
    <main className="min-h-[90vh] bg-transparent px-3 pb-36 pt-2 md:px-8 md:pt-6">
      <div className="mx-auto max-w-5xl">
        <section className="mb-6 md:mb-8">
          <div className="flex items-center gap-3">
            <div className="h-6 w-1 rounded-full bg-accent" />
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 md:text-2xl uppercase">
              Downloads
            </h1>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-400 max-w-xl">
            Songs saved for offline listening.
          </p>
          {downloadedSongs.length > 0 && (
            <div className="mt-3 md:mt-4 flex items-center gap-2 text-xs text-neutral-400">
              <Download size={13} />
              <span>{downloadedSongs.length} downloaded</span>
            </div>
          )}

          {storage && (
            <div className="mt-4 rounded-2xl bg-neutral-50/60 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs font-medium text-neutral-500">
                  <HardDrive size={13} />
                  <span>Device storage</span>
                </div>
                <span className={`text-[11px] font-semibold ${isFull ? "text-red-500" : "text-neutral-500"}`}>
                  {formatBytes(storage.usage)} / {formatBytes(storage.quota)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-neutral-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isFull ? "bg-red-500" : "bg-accent"
                  }`}
                  style={{ width: `${storagePercent}%` }}
                />
              </div>
              <p className={`mt-1.5 text-[11px] font-medium ${isFull ? "text-red-500" : "text-neutral-400"}`}>
                {isFull
                  ? "Storage is full — remove some downloads to free up space"
                  : `${formatBytes(storage.available)} available`}
              </p>
            </div>
          )}
        </section>

        {downloadedSongs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Disc className="mb-4 text-neutral-300" size={32} />
            <p className="text-sm font-semibold text-neutral-900">
              No downloads yet
            </p>
            <p className="mt-1 max-w-sm text-xs text-neutral-450">
              Download songs from the Songs page to listen offline.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-y-2 md:gap-y-3">
            {downloadedSongs.map((song) => (
              <div
                key={song.id}
                role="button"
                tabIndex={0}
                onClick={() => handlePlay(song.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") handlePlay(song.id);
                }}
                className="group flex w-full items-center gap-3 md:gap-3.5 rounded-2xl bg-neutral-50/60 p-3 text-left transition-all duration-300 hover:bg-neutral-100/80 hover:shadow-sm"
              >
                <div className="flex h-10 w-10 md:h-12 md:w-12 flex-shrink-0 items-center justify-center rounded-xl bg-neutral-900/5 text-neutral-800 transition-colors group-hover:bg-accent group-hover:text-white">
                  <Music size={18} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold tracking-tight text-neutral-900">
                    {song.title}
                  </p>
                  <p className="truncate text-[11px] font-medium text-neutral-400 mt-0.5">
                    {song.author}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition-all group-hover:bg-accent group-hover:text-white">
                    <Play size={13} fill="currentColor" className="ml-0.5" />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleRemove(e, song.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 transition hover:bg-red-50 hover:text-red-500"
                    title="Remove download"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
