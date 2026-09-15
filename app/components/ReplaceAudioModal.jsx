"use client";

import { useState, useEffect } from "react";

import { X, FileUp, Trash2, UploadCloud } from "lucide-react";
import { removeDownload, isSongDownloaded } from "@/lib/downloadManager";
import { evictCachedAudio } from "@/lib/cacheUtils";

const deleteR2Object = async (accessToken, publicStorageUrl) => {
  await fetch("/api/admin/storage", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ publicStorageUrl }),
  }).catch((error) => console.error("Unable to delete old audio file:", error));
};

/**
 * Swaps a track's audio file while keeping its database ID, so playlists,
 * library saves, and listening history keep pointing at the track.
 *
 * Order of operations (safe direction):
 * 1. upload the new file to R2
 * 2. point the song row at the new URL
 * 3. delete the old R2 object (best-effort — the new file is live already)
 */
const ReplaceAudioModal = ({ isOpen, onClose, onSuccess, song }) => {
  const [newFile, setNewFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape" && !isLoading) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, isLoading, onClose]);

  useEffect(() => {
    if (isOpen) {
      setNewFile(null);
      setProgress(0);
      setStatus("");
      setIsError(false);
    }
  }, [isOpen, song?.id]);

  if (!isOpen || !song) return null;

  const handleClose = () => {
    if (isLoading) return;
    onClose();
  };

  const handleReplace = async (e) => {
    e.preventDefault();
    if (!newFile) {
      setIsError(true);
      setStatus("Choose a replacement audio file first.");
      return;
    }

    let uploadedStorageUrl = null;
    const oldStorageUrl = song.song_path;

    try {
      setIsLoading(true);
      setIsError(false);
      setProgress(0);
      setStatus("Preparing secure upload…");

      const accessToken = localStorage.getItem("auth-token");
      if (!accessToken) throw new Error("Sign in again before replacing audio.");

      const signingResponse = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          filename: newFile.name,
          contentType: newFile.type,
          contentLength: newFile.size,
        }),
      });
      const signingBody = await signingResponse.json();
      if (!signingResponse.ok) throw new Error(signingBody.error || "Could not prepare the upload.");

      setStatus("Uploading replacement audio…");
      setProgress(35);
      const uploadResponse = await fetch(signingBody.presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": newFile.type },
        body: newFile,
      });
      if (!uploadResponse.ok) throw new Error("Cloudflare R2 rejected the audio upload.");
      uploadedStorageUrl = signingBody.publicStorageUrl;

      setStatus("Pointing track at the new file…");
      setProgress(75);
      const updateRes = await fetch("/api/data/songs", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ id: song.id, song_path: uploadedStorageUrl }),
      });
      if (!updateRes.ok) throw new Error("Failed to update song");
      const data = await updateRes.json();

      // Old file is now unreferenced — remove it (best-effort).
      if (oldStorageUrl && oldStorageUrl !== uploadedStorageUrl) {
        setStatus("Removing the old file…");
        await deleteR2Object(accessToken, oldStorageUrl);
        await evictCachedAudio(oldStorageUrl);
      }

      // Drop any stale offline copy of this track so devices can't keep
      // playing the old audio from cache.
      if (isSongDownloaded(song.id)) {
        await removeDownload(song.id).catch((err) =>
          console.error("Unable to clear stale download:", err)
        );
      }

      localStorage.removeItem("lumbo_songs_cache");
      setProgress(100);
      if (data?.[0]) onSuccess(data[0]);
      onClose();
    } catch (error) {
      console.error("Replace audio failed:", error);
      // The new file never got linked — clean it up so it doesn't orphan.
      if (uploadedStorageUrl) {
        const cleanupToken = localStorage.getItem("auth-token");
        if (cleanupToken) {
          await deleteR2Object(cleanupToken, uploadedStorageUrl);
        }
      }
      setIsError(true);
      setStatus(error.message || "Error replacing audio.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-neutral-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-neutral-100 bg-white p-6 shadow-2xl animate-fade-in md:p-8">
        <div className="mb-1 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold tracking-tight text-neutral-900">
              Replace audio
            </h2>
            <p className="mt-0.5 truncate text-sm text-neutral-500">
              {song.title} · {song.author}
            </p>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="shrink-0 rounded-full p-1 text-neutral-400 transition hover:text-neutral-900"
          >
            <X size={20} />
          </button>
        </div>
        <p className="mb-5 text-xs leading-relaxed text-neutral-500">
          The track keeps its ID — playlists, libraries, and history are unaffected. The old file is deleted after the swap.
        </p>

        <form onSubmit={handleReplace} className="flex flex-col gap-y-4">
          <div className="relative cursor-pointer rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50 p-6 text-center transition hover:border-accent/30">
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
              disabled={isLoading}
              required={!newFile}
              className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
            />
            <UploadCloud size={28} className={`mx-auto mb-2 transition-colors ${newFile ? "text-accent" : "text-neutral-300"}`} />
            {newFile ? (
              <div>
                <p className="truncate px-2 text-sm font-bold text-neutral-900">{newFile.name}</p>
                <p className="mt-1 text-xs font-medium text-neutral-500">
                  {(newFile.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
            ) : (
              <p className="text-sm font-semibold text-neutral-600">Select replacement audio</p>
            )}
          </div>

          {newFile && !isLoading && (
            <button
              type="button"
              onClick={() => setNewFile(null)}
              className="inline-flex items-center justify-center gap-1 self-center rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-500 transition hover:text-red-600"
            >
              <Trash2 size={12} /> Remove
            </button>
          )}

          {isLoading && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-accent">{status || "Replacing audio…"}</p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                  className={`h-full bg-accent transition-all duration-300 ease-out ${progress === 0 ? "w-1/3 animate-pulse" : ""}`}
                  style={progress === 0 ? {} : { width: `${progress}%` }}
                />
              </div>
            </div>
          )}
          {!isLoading && status && (
            <p role="status" className={`text-sm font-medium ${isError ? "text-red-600" : "text-neutral-600"}`}>
              {status}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-white shadow-sm transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileUp size={15} />
            {isLoading ? "Replacing…" : "Replace audio"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ReplaceAudioModal;
