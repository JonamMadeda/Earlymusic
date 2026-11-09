"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Check,
  Download,
  Flag,
  ListPlus,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { apiFetch } from "@/lib/apiFetch";
import { downloadSong, isSongDownloaded, removeDownload } from "@/lib/downloadManager";

/**
 * The player's overflow menu. Add-to-playlist, offline download and reporting
 * all already existed on the song rows; this surfaces the same flows without
 * leaving the now-playing screen.
 */
const SongOverflowMenu = ({ song, onStatus, onOfflineChange }) => {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const containerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("menu");
  const [playlists, setPlaylists] = useState([]);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [error, setError] = useState("");

  const say = useCallback(
    (message) => {
      setError(message);
      onStatus?.(message);
    },
    [onStatus]
  );

  useEffect(() => {
    if (!open) return;
    setDownloaded(isSongDownloaded(song?.id));

    const onPointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    // The player closes on Escape too. Stop the event here so Escape backs out
    // of the menu first instead of dismissing the whole player.
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      if (view !== "menu") setView("menu");
      else setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, view, song?.id]);

  useEffect(() => {
    if (!open || view !== "playlists" || !user) return;
    let cancelled = false;
    apiFetch(`/api/data/playlists?user_id=${user.id}&order=created_at&ascending=false`)
      .then((data) => {
        if (!cancelled) setPlaylists(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) say("Unable to load your playlists.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, view, user, say]);

  const requireAccount = () => {
    if (user) return true;
    setOpen(false);
    router.push(`/auth?redirectTo=${encodeURIComponent(pathname)}`);
    return false;
  };

  const addToPlaylist = async (playlistId) => {
    if (busy) return;
    setBusy(true);
    try {
      const existing = await apiFetch(
        `/api/data/playlist_songs?playlist_id=${playlistId}&song_id=${song.id}`
      );
      if (Array.isArray(existing) && existing.length > 0) {
        say("Already in that playlist.");
        return;
      }
      await apiFetch("/api/data/playlist_songs", {
        method: "POST",
        body: JSON.stringify({ playlist_id: playlistId, song_id: song.id }),
      });
      say("Added to playlist.");
      setOpen(false);
    } catch {
      say("Unable to add to that playlist.");
    } finally {
      setBusy(false);
    }
  };

  const createAndAdd = async (event) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name || busy || !user) return;
    setBusy(true);
    try {
      const created = await apiFetch("/api/data/playlists", {
        method: "POST",
        body: JSON.stringify({ name, user_id: user.id }),
      });
      if (!created?.id) throw new Error("no playlist");
      await apiFetch("/api/data/playlist_songs", {
        method: "POST",
        body: JSON.stringify({ playlist_id: created.id, song_id: song.id }),
      });
      setNewName("");
      say(`Added to ${name}.`);
      setOpen(false);
    } catch {
      say("Unable to create that playlist.");
    } finally {
      setBusy(false);
    }
  };

  const toggleDownload = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (downloaded) {
        await removeDownload(song.id);
        setDownloaded(false);
        onOfflineChange?.(false);
        say("Removed from downloads.");
      } else {
        await downloadSong(song);
        setDownloaded(true);
        onOfflineChange?.(true);
        say("Saved for offline listening.");
      }
    } catch (downloadError) {
      say(
        downloadError instanceof Error && downloadError.message === "Storage is full"
          ? "Device storage is full."
          : "Unable to save this song offline."
      );
    } finally {
      setBusy(false);
    }
  };

  const submitReport = async (event) => {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const reason = String(form.get("reason") || "").trim();
    if (!reason) {
      say("Please describe the issue.");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/api/dmca/report", {
        method: "POST",
        body: JSON.stringify({
          song_id: song.id,
          reason,
          reporter_name: String(form.get("reporter_name") || "").trim() || null,
          reporter_email: String(form.get("reporter_email") || "").trim() || null,
        }),
      });
      say("Report submitted. Thank you.");
      setOpen(false);
      setView("menu");
    } catch (reportError) {
      say(reportError instanceof Error ? reportError.message : "Unable to submit the report.");
    } finally {
      setBusy(false);
    }
  };

  if (!song) return null;

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="More actions for this song"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
          setView("menu");
          setError("");
        }}
        className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
          open ? "bg-neutral-200 text-neutral-900" : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
        }`}
      >
        <MoreHorizontal size={20} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Song actions"
          className="absolute right-0 top-full z-[1000] mt-2 w-72 rounded-2xl border border-neutral-200 bg-white p-2 shadow-2xl"
        >
          {view === "menu" && (
            <>
              <button
                type="button"
                className={itemClass}
                onClick={() => {
                  if (!requireAccount()) return;
                  setView("playlists");
                  setError("");
                }}
              >
                <ListPlus size={16} className="text-neutral-400" />
                Add to playlist
              </button>
              <button type="button" className={itemClass} disabled={busy} onClick={toggleDownload}>
                {busy ? (
                  <Loader2 size={16} className="animate-spin text-neutral-400" />
                ) : downloaded ? (
                  <Trash2 size={16} className="text-neutral-400" />
                ) : (
                  <Download size={16} className="text-neutral-400" />
                )}
                {downloaded ? "Remove download" : "Download for offline"}
              </button>
              <button
                type="button"
                className={itemClass}
                onClick={() => {
                  setView("report");
                  setError("");
                }}
              >
                <Flag size={16} className="text-neutral-400" />
                Report this song
              </button>
            </>
          )}

          {view === "playlists" && (
            <div className="p-1">
              <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                Add to playlist
              </p>
              <div className="max-h-52 space-y-0.5 overflow-y-auto custom-scrollbar">
                {playlists.length === 0 && (
                  <p className="px-2 py-3 text-xs text-neutral-500">No playlists yet.</p>
                )}
                {playlists.map((playlist) => (
                  <button
                    key={playlist.id}
                    type="button"
                    disabled={busy}
                    onClick={() => addToPlaylist(playlist.id)}
                    className={itemClass}
                  >
                    <Plus size={15} className="shrink-0 text-neutral-400" />
                    <span className="truncate">{playlist.name}</span>
                  </button>
                ))}
              </div>
              <form onSubmit={createAndAdd} className="mt-2 flex items-center gap-1.5">
                <input
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="New playlist…"
                  aria-label="New playlist name"
                  maxLength={80}
                  className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-2.5 py-2 text-xs outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={busy || !newName.trim()}
                  aria-label="Create playlist and add this song"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white transition disabled:opacity-40"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                </button>
              </form>
            </div>
          )}

          {view === "report" && (
            <form onSubmit={submitReport} className="space-y-2 p-1">
              <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                Report this song
              </p>
              <textarea
                name="reason"
                required
                rows={3}
                maxLength={1000}
                placeholder="Copyright infringement, offensive content, or incorrect attribution…"
                aria-label="Reason for the report"
                className="w-full resize-none rounded-lg border border-neutral-200 px-2.5 py-2 text-xs outline-none focus:border-accent"
              />
              <input
                name="reporter_name"
                maxLength={120}
                placeholder="Your name (optional)"
                aria-label="Your name"
                className="w-full rounded-lg border border-neutral-200 px-2.5 py-2 text-xs outline-none focus:border-accent"
              />
              <input
                name="reporter_email"
                type="email"
                maxLength={200}
                placeholder="Email (optional)"
                aria-label="Your email"
                className="w-full rounded-lg border border-neutral-200 px-2.5 py-2 text-xs outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-xs font-bold text-white transition disabled:opacity-50"
              >
                {busy && <Loader2 size={14} className="animate-spin" />}
                Submit report
              </button>
            </form>
          )}

          {error && (
            <p role="status" className="px-3 pb-1.5 pt-2 text-[11px] font-medium text-neutral-500">
              {error}
            </p>
          )}

          {view !== "menu" && (
            <button
              type="button"
              onClick={() => {
                setView("menu");
                setError("");
              }}
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold text-neutral-500 transition hover:bg-neutral-100"
            >
              <X size={12} />
              Back
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SongOverflowMenu;