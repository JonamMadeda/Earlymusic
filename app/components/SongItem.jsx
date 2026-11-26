"use client";

import { useState, useEffect } from "react";
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
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import SongAvatar from "@/app/components/SongAvatar";
import ActionMenu from "@/app/components/ActionMenu";
import ReportSongDialog from "@/app/components/ReportSongDialog";
import SongRightsNotice from "@/app/components/SongRightsNotice";

import { useAuth } from "@/app/context/AuthContext";

/**
 * SongItem renders a playable song row.
 * When `saved` and `onToggleSave` are provided (batched by the parent),
 * the per-row saved-state query is skipped entirely.
 *
 * The row keeps one quick action (save) and one overflow menu for everything
 * else, so a dense list stays scannable without hiding any capability.
 */
const SongItem = ({ song, onClick, saved, onToggleSave, isNew: isNewProp }) => {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
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
  const [showInfo, setShowInfo] = useState(false);
  const [showRights, setShowRights] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [shareFeedback, setShareFeedback] = useState("");
  const [showReport, setShowReport] = useState(false);

  const isSaved = saved !== undefined ? saved : internalSaved;

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

  const openPlaylists = () => {
    if (!user) {
      router.push(`/auth?redirectTo=${encodeURIComponent(pathname)}`);
      return;
    }
    setShowInfo(false);
    setShowRights(false);
    setShowPlaylists(true);
  };

  const backToMenu = () => {
    setShowInfo(false);
    setShowRights(false);
    setShowPlaylists(false);
  };

  const handleShare = async (event) => {
    event?.stopPropagation();
    try {
      const { shareSong } = await import("@/lib/share");
      const result = await shareSong(song);
      if (result === "copied") {
        setShareFeedback("Link copied!");
        setTimeout(() => setShareFeedback(""), 2000);
      } else if (result === "failed") {
        setShareFeedback("Share failed");
        setTimeout(() => setShareFeedback(""), 2000);
      }
    } catch (error) {
      console.error("Unable to share song:", error);
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

  const addToPlaylist = async (event, playlistId) => {
    event.stopPropagation();
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

  const createAndAdd = async (event) => {
    event.stopPropagation();
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

  const menuItemClass =
    "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(e);
        }
      }}
      className="group relative flex cursor-pointer items-center gap-3 px-2 py-2.5 text-left transition-colors duration-150 hover:bg-neutral-50 active:bg-neutral-100 sm:gap-3.5 sm:px-3"
    >
      <div className="relative shrink-0">
        <SongAvatar title={song.title} size="md" variant="mono" />
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
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
            <span className="shrink-0 rounded bg-ink/10 px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wider text-ink">
              New
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <p className="truncate text-xs font-medium text-neutral-400">
            {song.author}
          </p>
          <span className="h-1 w-1 shrink-0 rounded-full bg-neutral-300" />
          <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-neutral-400">
            {normalizedCategory}
          </span>
          {song.duration === "Short" && (
            <span className="shrink-0 rounded border border-neutral-900 bg-neutral-900 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
              Short
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            handleToggleSave();
          }}
          aria-label={isSaved ? `Remove ${song.title} from Liked` : `Save ${song.title} to Liked`}
          title={isSaved ? "Remove from Liked" : "Save to Liked"}
          className="tap-sm flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-accent"
        >
          <Heart
            size={17}
            className={isSaved ? "fill-accent text-accent" : ""}
            aria-hidden="true"
          />
        </button>

        <ActionMenu
          label={`More actions for ${song.title || "this song"}`}
          triggerTitle="More"
          className="shrink-0"
        >
          <div onClick={(event) => event.stopPropagation()}>
            {showInfo ? (
              <>
                <button type="button" onClick={backToMenu} className={menuItemClass}>
                  <ArrowLeft size={16} className="text-neutral-400" aria-hidden="true" />
                  Back
                </button>
                <div className="mt-1 border-t border-neutral-100 pt-3">
                  <h4 className="px-3 text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Compilation Details
                  </h4>
                  <div className="custom-scrollbar flex max-h-60 flex-col gap-3 overflow-y-auto px-3 py-3">
                    {song.original_songs && song.original_songs.length > 0 ? (
                      song.original_songs.map((entry, i) => (
                        <div key={i} className="flex flex-col gap-0.5">
                          <p className="text-sm font-bold leading-tight text-neutral-900">
                            {entry.title || "Unknown Title"}
                          </p>
                          <p className="text-xs font-medium text-neutral-500">
                            Original Artist:{" "}
                            <span className="text-neutral-900">{entry.artist || "Unknown"}</span>
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="py-1 text-xs italic text-neutral-400">
                        No original song details available.
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : showPlaylists ? (
              <>
                <button type="button" onClick={backToMenu} className={menuItemClass}>
                  <ArrowLeft size={16} className="text-neutral-400" aria-hidden="true" />
                  Back
                </button>
                <div className="mt-1 border-t border-neutral-100 px-3 py-3">
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Add to Playlist
                  </h4>
                  <div className="custom-scrollbar flex max-h-48 flex-col gap-0.5 overflow-y-auto">
                    {playlists.length === 0 ? (
                      <p className="py-2 text-center text-xs italic text-neutral-400">
                        No playlists yet
                      </p>
                    ) : (
                      playlists.map((pl) => (
                        <button
                          key={pl.id}
                          type="button"
                          onClick={(event) => addToPlaylist(event, pl.id)}
                          className={menuItemClass}
                        >
                          <ListMusic size={16} className="text-neutral-400" aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate">{pl.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2 border-t border-neutral-100 pt-3">
                    <input
                      type="text"
                      placeholder="New playlist..."
                      value={newPlaylistName}
                      onChange={(event) => setNewPlaylistName(event.target.value)}
                      onKeyDown={(event) => event.key === "Enter" && createAndAdd(event)}
                      className="min-w-0 flex-1 rounded-full border border-neutral-200/80 bg-neutral-50/60 px-3.5 py-2.5 text-xs font-medium outline-none transition placeholder:text-neutral-300 focus:border-neutral-300 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={createAndAdd}
                      disabled={!newPlaylistName.trim()}
                      aria-label="Create playlist and add this song"
                      title="Create & Add"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white transition hover:bg-accent/90 disabled:opacity-50"
                    >
                      <Plus size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </>
            ) : showRights ? (
              <>
                <button type="button" onClick={backToMenu} className={menuItemClass}>
                  <ArrowLeft size={16} className="text-neutral-400" aria-hidden="true" />
                  Back
                </button>
                <div className="mt-1">
                  <SongRightsNotice song={song} compact />
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setShowInfo(true);
                    setShowRights(false);
                    setShowPlaylists(false);
                  }}
                  className={menuItemClass}
                >
                  <Info size={16} className="text-neutral-400" aria-hidden="true" />
                  Compilation Details
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRights(true);
                    setShowInfo(false);
                    setShowPlaylists(false);
                  }}
                  className={menuItemClass}
                >
                  <ShieldCheck size={16} className="text-neutral-400" aria-hidden="true" />
                  Rights &amp; archive use
                </button>
                <button type="button" onClick={openPlaylists} className={menuItemClass}>
                  <ListPlus size={16} className="text-neutral-400" aria-hidden="true" />
                  Add to Playlist
                </button>
                <button type="button" onClick={handleShare} className={menuItemClass}>
                  {shareFeedback ? (
                    <Check size={16} className="text-green-600" strokeWidth={3} aria-hidden="true" />
                  ) : (
                    <Share2 size={16} className="text-neutral-400" aria-hidden="true" />
                  )}
                  {shareFeedback || "Share song"}
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleToggleSave();
                  }}
                  className={menuItemClass}
                >
                  <Heart
                    size={16}
                    className={isSaved ? "fill-neutral-900 text-neutral-900" : "text-neutral-400"}
                    aria-hidden="true"
                  />
                  {isSaved ? "Remove from Library" : "Add to Library"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowReport(true);
                  }}
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
                >
                  <Flag size={16} className="text-red-500" aria-hidden="true" />
                  Report this song
                </button>
              </>
            )}
          </div>
        </ActionMenu>
      </div>

      <ReportSongDialog
        open={showReport}
        onClose={() => setShowReport(false)}
        song={song}
      />
    </div>
  );
};

export default SongItem;
