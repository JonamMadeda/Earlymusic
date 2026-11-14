"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  HardDrive,
  Trash2,
  RotateCcw,
  Download,
  RefreshCw,
  Timer,
  ShieldCheck,
} from "lucide-react";
import {
  getDownloadedSongs,
  getStorageEstimate,
  stageClearDownloads,
  undoClearDownloads,
  commitClearDownloads,
  pruneOrphanedDownloads,
} from "@/lib/downloadManager";
import ConfirmModal from "../components/ConfirmModal";
import UndoToast from "../components/UndoToast";
import { SleepTimerSettings } from "../components/SleepTimer";
import AnalyticsConsentControl from "../components/AnalyticsConsentControl";

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

export default function SettingsPage() {
  const [storage, setStorage] = useState(null);
  const [downloadedSongs, setDownloadedSongs] = useState([]);
  const [confirmAction, setConfirmAction] = useState(null);
  const [undoSnapshot, setUndoSnapshot] = useState(null);
  const [clearingAll, setClearingAll] = useState(false);
  const undoRef = useRef(null);

  const refresh = useCallback(() => {
    setDownloadedSongs(getDownloadedSongs());
    getStorageEstimate().then(setStorage);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      // A tab closed mid-undo-window can leave marked audio with no stored
      // record; drop those orphans before showing storage numbers.
      try {
        await pruneOrphanedDownloads();
      } catch {}
      refresh();
    }, 0);
    return () => clearTimeout(timeout);
  }, [refresh]);

  // Leaving the page closes the undo window: finalize the staged deletion.
  useEffect(() => {
    return () => {
      if (undoRef.current) {
        commitClearDownloads(undoRef.current);
        undoRef.current = null;
      }
    };
  }, []);

  const confirmClearDownloads = () => {
    const snapshot = stageClearDownloads();
    undoRef.current = snapshot;
    setUndoSnapshot(snapshot);
    setConfirmAction(null);
    refresh();
  };

  const handleUndoClear = () => {
    if (!undoRef.current) return;
    undoClearDownloads(undoRef.current);
    undoRef.current = null;
    setUndoSnapshot(null);
    refresh();
  };

  const commitClear = () => {
    const snapshot = undoRef.current;
    if (!snapshot) return;
    undoRef.current = null;
    setUndoSnapshot(null);
    commitClearDownloads(snapshot).then(refresh);
  };

  const clearAllData = async () => {
    undoRef.current = null;
    setUndoSnapshot(null);
    setClearingAll(true);
    try {
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch (error) {
      console.error("Unable to clear caches:", error);
    }
    localStorage.removeItem("lumbo_downloaded_songs");
    localStorage.removeItem("lumbo_recently_played");
    localStorage.removeItem("lumbo_player_expanded");
    // Clear every remaining app preference too, so "Reset App Data" matches
    // what it says: playback state, notification state, and consent choices.
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("lumbo_") || key.startsWith("lumbo-")) {
        localStorage.removeItem(key);
      }
    }
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

  const downloadCount = downloadedSongs.length;

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
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <HardDrive size={16} className="text-neutral-400" aria-hidden="true" />
              <h2 className="section-title">Storage</h2>
            </div>
            {storage && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-neutral-500">
                    {formatBytes(storage.usage)} used
                  </span>
                  <span className="text-xs text-neutral-400">
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
                <p className="mt-1 text-xs text-neutral-400">
                  {formatBytes(storage.available)} available
                </p>
              </div>
            )}
            {!storage && (
              <p className="text-xs text-neutral-400">Storage info not available on this device.</p>
            )}
            <div className="mt-1 text-xs text-neutral-400 flex items-center gap-2">
              <Download size={12} aria-hidden="true" />
              <span>{downloadCount} downloaded songs</span>
            </div>
          </div>

          {/* Sleep Timer */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <Timer size={16} className="text-neutral-400" aria-hidden="true" />
              <h2 className="section-title">Sleep Timer</h2>
            </div>
            <p className="text-sm text-neutral-500 mb-4">
              Automatically stop playback after a set time. Leave it off to play continuously.
            </p>
            <SleepTimerSettings />
          </div>

          {/* Privacy & consent */}
          <div id="privacy" className="card scroll-mt-24 p-5">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={16} className="text-neutral-400" aria-hidden="true" />
              <h2 className="section-title">Privacy &amp; consent</h2>
            </div>
            <p className="text-sm text-neutral-500 mb-4">
              Control analytics and review how your data is handled.
            </p>
            <AnalyticsConsentControl />
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-neutral-200/70 pt-3 text-xs font-semibold">
              <Link href="/privacy" className="text-accent hover:underline">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-accent hover:underline">
                Terms of Service
              </Link>
              <Link href="/privacy#choices" className="text-accent hover:underline">
                Your rights
              </Link>
              <Link href="/accessibility" className="text-accent hover:underline">
                Accessibility
              </Link>
            </div>
          </div>

          {/* Clear Downloads */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <Trash2 size={16} className="text-neutral-400" aria-hidden="true" />
              <h2 className="section-title">Downloads</h2>
            </div>
            <p className="text-sm text-neutral-500 mb-4">
              Remove all downloaded songs and free up device storage.
            </p>
            <button
              onClick={() => setConfirmAction("downloads")}
              disabled={downloadCount === 0}
              className="btn-destructive-outline"
            >
              <Trash2 size={15} aria-hidden="true" />
              Clear Downloads
            </button>
          </div>

          {/* Clear All App Data */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <RotateCcw size={16} className="text-neutral-400" aria-hidden="true" />
              <h2 className="section-title">Reset App Data</h2>
            </div>
            <p className="text-sm text-neutral-500 mb-4">
              Clear downloads, cached songs, playback state, notification state,
              and consent preferences. The app will reload automatically.
            </p>
            <button
              onClick={() => setConfirmAction("reset")}
              disabled={clearingAll}
              className="btn-destructive"
            >
              <RotateCcw size={15} aria-hidden="true" />
              {clearingAll ? "Resetting..." : "Reset All Data"}
            </button>
          </div>

          {/* Refresh App */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw size={16} className="text-neutral-400" aria-hidden="true" />
              <h2 className="section-title">Update App</h2>
            </div>
            <p className="text-sm text-neutral-500 mb-4">
              Check for the latest version and refresh to apply any pending updates.
            </p>
            <button onClick={refreshApp} className="btn-primary">
              <RefreshCw size={15} aria-hidden="true" />
              Refresh Now
            </button>
          </div>

          {/* Version */}
          <div className="card px-5 py-3">
            <p className="text-xs font-medium text-neutral-400 text-center">
              Luumbo v1.0.0
            </p>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmAction === "downloads"}
        title="Clear all downloads?"
        message="Offline copies will be removed from this device. You can undo for a few seconds afterwards."
        details={{
          removed: [
            `${downloadCount} downloaded ${downloadCount === 1 ? "song" : "songs"} (offline audio)`,
          ],
          kept: ["Your saved songs and playlists", "Streaming playback while online"],
        }}
        confirmLabel="Clear Downloads"
        onConfirm={confirmClearDownloads}
        onClose={() => setConfirmAction(null)}
      />

      <ConfirmModal
        isOpen={confirmAction === "reset"}
        title="Reset all app data?"
        message="Everything stored on this device will be cleared and the app will reload. This cannot be undone."
        details={{
          removed: [
            "All downloaded songs and cached audio",
            "Recently played and playback state",
            "Notification and consent preferences",
          ],
          kept: [
            "Your account and sign-in",
            "Saved songs, playlists, and profile (stored online)",
          ],
        }}
        confirmLabel="Reset All Data"
        busy={clearingAll}
        onConfirm={clearAllData}
        onClose={() => setConfirmAction(null)}
      />

      {undoSnapshot && (
        <UndoToast
          key={undoSnapshot.id}
          expiresAt={undoSnapshot.expiresAt}
          message={`${undoSnapshot.songs.length} ${undoSnapshot.songs.length === 1 ? "download" : "downloads"} cleared`}
          onAction={handleUndoClear}
          onDismiss={commitClear}
        />
      )}
    </main>
  );
}