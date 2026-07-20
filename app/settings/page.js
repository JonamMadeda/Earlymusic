"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Settings,
  HardDrive,
  Trash2,
  RotateCcw,
  Download,
  RefreshCw,
} from "lucide-react";
import { getDownloadedSongs, removeDownload, getStorageEstimate } from "@/lib/downloadManager";

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

export default function SettingsPage() {
  const [storage, setStorage] = useState(null);
  const [downloadedSongs, setDownloadedSongs] = useState([]);
  const [clearingDownloads, setClearingDownloads] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  const refresh = useCallback(() => {
    setDownloadedSongs(getDownloadedSongs());
    getStorageEstimate().then(setStorage);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const clearDownloads = async () => {
    setClearingDownloads(true);
    const songs = getDownloadedSongs();
    for (const song of songs) {
      await removeDownload(song.id);
    }
    refresh();
    setClearingDownloads(false);
  };

  const clearAllData = async () => {
    setClearingAll(true);
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    localStorage.removeItem("earlymusic_downloaded_songs");
    localStorage.removeItem("earlymusic_songs_cache");
    localStorage.removeItem("earlymusic_recently_played");
    localStorage.removeItem("earlymusic_player_expanded");
    window.location.reload();
  };

  const refreshApp = () => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) reg.update();
      });
    }
    window.location.reload();
  };

  const storagePercent = storage && storage.quota > 0
    ? Math.min((storage.usage / storage.quota) * 100, 100)
    : 0;

  return (
    <main className="min-h-[90vh] bg-transparent px-3 pb-36 pt-2 md:px-8 md:pt-6">
      <div className="mx-auto max-w-5xl">
        <section className="mb-6 md:mb-8">
          <div className="flex items-center gap-3">
            <div className="h-6 w-1 rounded-full bg-accent" />
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 md:text-2xl uppercase">
              Settings
            </h1>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-400 max-w-xl">
            Manage storage, data, and app preferences.
          </p>
        </section>

        <div className="flex flex-col gap-4">
          {/* Storage */}
          <div className="rounded-2xl bg-neutral-50/60 p-5 backdrop-blur-2xl hover:shadow-md">
            <div className="flex items-center gap-2 mb-3">
              <HardDrive size={15} className="text-neutral-400" />
              <h2 className="text-sm font-bold tracking-tight text-neutral-900">Storage</h2>
            </div>
            {storage && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-neutral-500">
                    {formatBytes(storage.usage)} used
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    {formatBytes(storage.quota)} total
                  </span>
                </div>
                <div className="h-2 rounded-full bg-neutral-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      storagePercent >= 95 ? "bg-red-500" : "bg-accent"
                    }`}
                    style={{ width: `${storagePercent}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-neutral-400">
                  {formatBytes(storage.available)} available
                </p>
              </div>
            )}
            {!storage && (
              <p className="text-xs text-neutral-400">Storage info not available on this device.</p>
            )}
            <div className="mt-1 text-xs text-neutral-400 flex items-center gap-2">
              <Download size={12} />
              <span>{downloadedSongs.length} downloaded songs</span>
            </div>
          </div>

          {/* Clear Downloads */}
          <div className="rounded-2xl bg-neutral-50/60 p-5 backdrop-blur-2xl hover:shadow-md">
            <div className="flex items-center gap-2 mb-2">
              <Trash2 size={15} className="text-neutral-400" />
              <h2 className="text-sm font-bold tracking-tight text-neutral-900">Downloads</h2>
            </div>
            <p className="text-xs text-neutral-500 mb-4">
              Remove all downloaded songs and free up device storage.
            </p>
            <button
              onClick={clearDownloads}
              disabled={clearingDownloads || downloadedSongs.length === 0}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-accent/90 disabled:opacity-40"
            >
              <Trash2 size={13} />
              {clearingDownloads ? "Clearing..." : "Clear Downloads"}
            </button>
          </div>

          {/* Clear All App Data */}
          <div className="rounded-2xl bg-neutral-50/60 p-5 backdrop-blur-2xl">
            <div className="flex items-center gap-2 mb-2">
              <RotateCcw size={15} className="text-neutral-400" />
              <h2 className="text-sm font-bold tracking-tight text-neutral-900">Reset App Data</h2>
            </div>
            <p className="text-xs text-neutral-500 mb-4">
              Clear all cached data including downloads, song cache, and recently played. The app
              will reload automatically.
            </p>
            <button
              onClick={clearAllData}
              disabled={clearingAll}
              className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
            >
              <RotateCcw size={13} />
              {clearingAll ? "Resetting..." : "Reset All Data"}
            </button>
          </div>

          {/* Refresh App */}
          <div className="rounded-2xl bg-neutral-50/60 p-5 backdrop-blur-2xl hover:shadow-md">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw size={15} className="text-neutral-400" />
              <h2 className="text-sm font-bold tracking-tight text-neutral-900">Update App</h2>
            </div>
            <p className="text-xs text-neutral-500 mb-4">
              Check for the latest version and refresh to apply any pending updates.
            </p>
            <button
              onClick={refreshApp}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-accent/90"
            >
              <RefreshCw size={13} />
              Refresh Now
            </button>
          </div>

          {/* Version */}
          <div className="rounded-2xl bg-neutral-50/60 px-5 py-3 backdrop-blur-2xl hover:shadow-md">
            <p className="text-[11px] font-medium text-neutral-400 text-center">
              Early Music v1.0.0
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
