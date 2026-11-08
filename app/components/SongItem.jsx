"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Heart,
  Info,
  ListPlus,
  ListMusic,
  Plus,
  Play,
  Share2,
  Check,
  Flag,
  X,
  MoreHorizontal,
} from "lucide-react";
import SongAvatar from "@/app/components/SongAvatar";

import { useAuth } from "@/app/context/AuthContext";

/**
 * SongItem renders a playable song row.
 * When `saved` and `onToggleSave` are provided (batched by the parent),
 * the per-row saved-state query is skipped entirely.
 */
const SongItem = ({ song, onClick, saved, onToggleSave, isNew: isNewProp }) => {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const rowRef = useRef(null);
  const normalizedCategory = (song.category || "Worship").trim();
  // Rank-based "new" (top-15 by created_at) when the parent passes isNew;
  // otherwise fall back to the 30-day window.
  const isNew =
    isNewProp !== undefined
      ? isNewProp
      : !!(
          song.created_at &&
          Date.now() - new Date(song.created_at).getTime() <
            30 * 24 * 60 * 60 * 1000
        );

  const [internalSaved, setInternalSaved] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [shareFeedback, setShareFeedback] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [reportFeedback, setReportFeedback] = useState("");

  const isSaved = saved !== undefined ? saved : internalSaved;

  useEffect(() => {
    if (!showMenu && !showInfo && !showPlaylists) return;

    const handleClickOutside = (e) => {
      if (rowRef.current && !rowRef.current.contains(e.target)) {
        setShowMenu(false);
        setShowInfo(false);
        setShowPlaylists(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu, showInfo, showPlaylists]);

  useEffect(() => {
    if (saved !== undefined) return;
    if (!user) {
      setInternalSaved(false);
      return;
    }
    fetch(`/api/data/saved_songs?song_id=${song.id}`, {
      credentials: "same-origin",
    })
      .then((res) => res.json())
      .then((data) => setInternalSaved(Array.isArray(data) && data.length > 0))
      .catch((error) => console.error("Unable to check saved song:", error));
  }, [user, song.id, saved]);

  useEffect(() => {
    if (showPlaylists && user) {
      fetch(`/api/data/playlists?user_id=${user.id}&order=created_at&ascending=false`, {
        credentials: "same-origin",
      })
        .then((res) => res.json())
        .then((data) => setPlaylists(Array.isArray(data) ? data : []))
        .catch((error) => console.error("Unable to load playlists:", error));
    }
  }, [showPlaylists, user]);

  const handleShare = async (e) => {
    e.stopPropagation();
    try {
      const { shareSong } = await import("@/lib/share");
      const result = await shareSong(song);
      if (result === "copied") {
        setShareFeedback("Link copied!");
        setTimeout(() => setShareFeedback(""), 2000);
      } else if (result === "failed") {
        setShareFeedback("Share failed");
        setTimeout(() => setShareFeedback(""), 2000);
      } else {
        setShowMenu(false);
      }
    } catch (error) {
      console.error("Unable to share song:", error);
    }
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    setReportFeedback("");
    const formData = new FormData(e.target);
    const reason = formData.get("reason");
    const reporterName = formData.get("reporter_name");
    const reporterEmail = formData.get("reporter_email");
    if (!reason || typeof reason !== "string") {
      setReportFeedback("Please describe the issue.");
      return;
    }
    try {
      const response = await fetch("/api/dmca/report", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ song_id: song.id, reason, reporter_name: reporterName || null, reporter_email: reporterEmail || null }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to submit report.");
      setShowReport(false);
      setReportFeedback("Report submitted. Thank you.");
      setTimeout(() => setReportFeedback(""), 4000);
    } catch (error) {
      console.error("Unable to submit DMCA report:", error);
      setReportFeedback(error instanceof Error ? error.message : "Unable to submit report.");
    }
  };

  const handleToggleSave = async () => {
    if (onToggleSave) {
      await onToggleSave(song.id);
      return;
    }
    if (!user) {
      router.push(`/auth?redirectTo=${encodeURIComponent(pathname)}`);
      return;
    }
    const headers = { "Content-Type": "application/json" };
    try {
      if (internalSaved) {
        // Filters belong in the query string: the data API ignores bodies
        // on DELETE, and a filterless call would remove ALL saved songs.
        const res = await fetch(`/api/data/saved_songs?song_id=${song.id}`, {
          method: "DELETE",
          credentials: "same-origin",
          headers,
        });
        if (!res.ok) throw new Error("Failed to unlike");
        setInternalSaved(false);
      } else {
        const res = await fetch("/api/data/saved_songs", {
          method: "POST",
          credentials: "same-origin",
          headers,
          body: JSON.stringify({ song_id: song.id }),
        });
        if (!res.ok) throw new Error("Failed to like");
        setInternalSaved(true);
      }
    } catch (error) {
      console.error("Unable to update saved song:", error);
    }
  };

  const addToPlaylist = async (e, playlistId) => {
    e.stopPropagation();
    const headers = { "Content-Type": "application/json" };
    try {
      const checkRes = await fetch(
        `/api/data/playlist_songs?playlist_id=${playlistId}&song_id=${song.id}`,
        { credentials: "same-origin", headers }
      );
      const existing = await checkRes.json();
      if (Array.isArray(existing) && existing.length > 0) return;
      const res = await fetch("/api/data/playlist_songs", {
        method: "POST",
        credentials: "same-origin",
        headers,
        body: JSON.stringify({ playlist_id: playlistId, song_id: song.id }),
      });
      if (!res.ok) throw new Error("Failed to add to playlist");
    } catch (error) {
      console.error("Unable to add song to playlist:", error);
    }
  };

  const createAndAdd = async (e) => {
    e.stopPropagation();
    const name = newPlaylistName.trim();
    if (!name || !user) return;
    const headers = { "Content-Type": "application/json" };
    try {
      const createRes = await fetch("/api/data/playlists", {
        method: "POST",
        credentials: "same-origin",
        headers,
        body: JSON.stringify({ name, user_id: user.id }),
      });
      if (!createRes.ok) throw new Error("Failed to create playlist");
      const pl = await createRes.json();
      if (pl) {
        const res = await fetch("/api/data/playlist_songs", {
          method: "POST",
          credentials: "same-origin",
          headers,
          body: JSON.stringify({ playlist_id: pl.id, song_id: song.id }),
        });
        if (!res.ok) throw new Error("Failed to add to playlist");
        setNewPlaylistName("");
        setShowPlaylists(false);
      }
    } catch (error) {
      console.error("Unable to create playlist:", error);
    }
  };

  return (
    <div
      ref={rowRef}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(e); } }}
      className={`group relative flex cursor-pointer items-center gap-3.5 rounded-2xl border border-neutral-200 bg-white p-3.5 text-left shadow-sm transition-all duration-300 hover:border-neutral-300 hover:shadow-md ${
        showMenu || showInfo || showPlaylists ? "z-50" : ""
      }`}
    >
      <div className="relative shrink-0">
        <SongAvatar title={song.title} size="md" variant="mono" />
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/30 opacity-0 transition-all duration-300 group-hover:opacity-100">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white shadow-md shadow-accent/20">
            <Play size={13} fill="currentColor" className="ml-0.5" />
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold tracking-tight text-neutral-900">
            {song.title}
          </p>
          {isNew && (
            <span className="rounded bg-accent/[0.06] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-accent">
              New
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <p className="truncate text-[11px] font-medium text-neutral-400">
            {song.author}
          </p>
          <span className="h-1 w-1 rounded-full bg-neutral-300" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
            {normalizedCategory}
          </span>
          {song.duration === "Short" && (
            <span className="rounded border border-neutral-900 bg-neutral-900 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
              Short
            </span>
          )}
        </div>
      </div>

      <div className="relative flex items-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
            setShowInfo(false);
            setShowPlaylists(false);
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition-all duration-300 hover:bg-accent hover:text-white"
          title="More"
        >
          <MoreHorizontal size={14} />
        </button>

        {showMenu && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 z-50 mt-12 min-w-[210px] rounded-2xl border border-neutral-100 bg-white p-2 shadow-lg"
          >
            <button
              onClick={() => {
                setShowInfo(true);
                setShowMenu(false);
                setShowPlaylists(false);
              }}
              className="flex w-full items-center gap-x-3 rounded-2xl px-3 py-3 text-left text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
            >
              <Info size={16} className="text-neutral-400" />
              <span className="text-[13px] font-semibold">Compilation Details</span>
            </button>
            <button
              onClick={() => {
                if (!user) {
                  router.push(`/auth?redirectTo=${encodeURIComponent(pathname)}`);
                  return;
                }
                setShowPlaylists(true);
                setShowInfo(false);
                setShowMenu(false);
              }}
              className="flex w-full items-center gap-x-3 rounded-2xl px-3 py-3 text-left text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
            >
              <ListPlus size={16} className="text-neutral-400" />
              <span className="text-[13px] font-semibold">Add to Playlist</span>
            </button>
            <button
              onClick={handleShare}
              className="flex w-full items-center gap-x-3 rounded-2xl px-3 py-3 text-left text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
            >
              {shareFeedback ? (
                <Check size={16} className="text-green-500" strokeWidth={3} />
              ) : (
                <Share2 size={16} className="text-neutral-400" />
              )}
              <span className="text-[13px] font-semibold">
                {shareFeedback || "Share song"}
              </span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleSave().finally(() => setShowMenu(false));
              }}
              className="flex w-full items-center gap-x-3 rounded-2xl px-3 py-3 text-left text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
            >
              <Heart
                size={16}
                className={isSaved ? "text-neutral-900 fill-neutral-900" : "text-neutral-400"}
              />
              <span className="text-[13px] font-semibold">
                {isSaved ? "Remove from Library" : "Add to Library"}
              </span>
            </button>
            <button
              onClick={() => {
                e.stopPropagation();
                setShowMenu(false);
                setShowReport(true);
              }}
              className="flex w-full items-center gap-x-3 rounded-2xl px-3 py-3 text-left text-red-600 transition hover:bg-red-50 hover:text-red-700"
            >
              <Flag size={16} className="text-red-500" />
              <span className="text-[13px] font-semibold">Report this song</span>
            </button>
          </div>
        )}
      </div>

      {showInfo && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-0 z-50 mt-12 min-w-[260px] rounded-2xl border border-neutral-100 bg-white p-5 shadow-lg"
        >
          <div className="flex flex-col gap-y-4">
            <div className="flex items-center justify-between border-b border-neutral-50 pb-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Compilation Details
              </h4>
              <button
                onClick={() => setShowInfo(false)}
                className="text-neutral-300 transition hover:text-neutral-900"
              >
                <Info size={14} />
              </button>
            </div>

            <div className="custom-scrollbar flex max-h-[250px] flex-col gap-y-4 overflow-y-auto pr-1">
              {song.original_songs && song.original_songs.length > 0 ? (
                song.original_songs.map((entry, i) => (
                  <div key={i} className="group/entry flex flex-col gap-y-1">
                    <p className="text-[14px] font-bold leading-tight text-neutral-900">
                      {entry.title || "Unknown Title"}
                    </p>
                    <p className="text-[12px] font-medium text-neutral-500">
                      Original Artist:{" "}
                      <span className="text-neutral-900">
                        {entry.artist || "Unknown"}
                      </span>
                    </p>
                  </div>
                ))
              ) : (
                <p className="py-2 text-[12px] italic text-neutral-400">
                  No original song details available.
                </p>
              )}
            </div>

            {(song.copyright_holder || song.license_type || song.license_url || song.rights_clearance_date) && (
              <div className="pt-2 border-t border-neutral-50">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
                  Rights &amp; Licensing
                </h4>
                {song.copyright_holder && (
                  <p className="text-[12px] font-medium text-neutral-700">
                    <span className="font-bold">Copyright:</span>{" "}
                    {song.copyright_holder}
                  </p>
                )}
                {song.license_type && (
                  <p className="text-[12px] font-medium text-neutral-700">
                    <span className="font-bold">License:</span>{" "}
                    {song.license_type}
                  </p>
                )}
                {song.license_url && (
                  <a
                    href={song.license_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] font-medium text-accent hover:underline"
                  >
                    View license
                  </a>
                )}
                {song.rights_clearance_date && (
                  <p className="text-[12px] font-medium text-neutral-700">
                    <span className="font-bold">Cleared on:</span>{" "}
                    {new Date(song.rights_clearance_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showPlaylists && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-0 z-50 mt-12 min-w-[240px] rounded-2xl border border-neutral-100 bg-white p-4 shadow-lg"
        >
          <div className="mb-3 flex items-center justify-between border-b border-neutral-50 pb-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Add to Playlist
            </h4>
            <button
              onClick={() => setShowPlaylists(false)}
              className="text-neutral-300 transition hover:text-neutral-900"
            >
              <Info size={14} />
            </button>
          </div>

          <div className="custom-scrollbar flex max-h-[200px] flex-col gap-y-1 overflow-y-auto">
            {playlists.length === 0 ? (
              <p className="py-2 text-center text-[12px] italic text-neutral-400">
                No playlists yet
              </p>
            ) : (
              playlists.map((pl) => (
                <button
                  key={pl.id}
                  onClick={(e) => addToPlaylist(e, pl.id)}
                  className="flex w-full items-center gap-x-3 rounded-2xl px-3 py-3 text-left text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
                >
                  <ListMusic size={16} className="text-neutral-400" />
                  <span className="flex-1 truncate text-[13px] font-semibold">
                    {pl.name}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="mt-2 border-t border-neutral-50 pt-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="New playlist..."
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createAndAdd(e)}
                className="flex-1 rounded-full border border-neutral-200/80 bg-neutral-50/60 px-3.5 py-2.5 text-[12px] font-medium outline-none transition placeholder:text-neutral-300 focus:border-neutral-300 focus:bg-white"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={createAndAdd}
                disabled={!newPlaylistName.trim()}
                className="flex-shrink-0 rounded-full bg-accent p-2.5 text-white transition hover:bg-accent/90 disabled:opacity-50"
                title="Create & Add"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {showReport && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-0 z-50 mt-12 min-w-[280px] rounded-2xl border border-neutral-100 bg-white p-5 shadow-lg"
        >
          <div className="flex flex-col gap-y-4">
            <div className="flex items-center justify-between border-b border-neutral-50 pb-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Report this song
              </h4>
              <button
                onClick={() => setShowReport(false)}
                aria-label="Close report form"
                className="text-neutral-300 transition hover:text-neutral-900"
              >
                <X size={14} />
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-neutral-400">
              Report copyright infringement, offensive content, or incorrect
              attribution. For copyright claims, include the work, the link to
              this song, and your contact details so we can follow up.{" "}
              <Link
                href="/terms#copyright"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-accent hover:underline"
              >
                What a copyright notice needs
              </Link>
              .
            </p>
            {reportFeedback && (
              <p className={`text-xs font-medium ${reportFeedback.includes("submitted") ? "text-green-600" : "text-red-600"}`}>
                {reportFeedback}
              </p>
            )}
            <form onSubmit={handleReportSubmit} className="flex flex-col gap-y-3">
              <div className="flex flex-col gap-y-1">
                <label className="text-[11px] font-semibold text-neutral-500">
                  What is the issue?
                </label>
                <textarea
                  name="reason"
                  rows={3}
                  placeholder="e.g. copyright infringement, offensive content, incorrect attribution..."
                  className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:bg-white"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-y-2">
                <div className="flex flex-col gap-y-1">
                  <label className="text-[11px] font-semibold text-neutral-500">
                    Your name (optional)
                  </label>
                  <input
                    name="reporter_name"
                    type="text"
                    placeholder="John Doe"
                    className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:bg-white"
                  />
                </div>
                <div className="flex flex-col gap-y-1">
                  <label className="text-[11px] font-semibold text-neutral-500">
                    Your email (for a reply)
                  </label>
                  <input
                    name="reporter_email"
                    type="email"
                    placeholder="you@example.com"
                    className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:bg-white"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="rounded-lg bg-accent px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-accent/90 active:scale-95"
              >
                Submit Report
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SongItem;