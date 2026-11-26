"use client";

import { useEffect, useLayoutEffect, useMemo, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/apiFetch";
import { usePlayer } from "../context/PlayerContext";
import { useAuth } from "../context/AuthContext";
import { PageSkeleton } from "../components/Skeleton";
import SongAvatar from "../components/SongAvatar";
import { prefetchSongAudio } from "@/lib/prefetchAudio";
import { getNewestSongs } from "@/lib/newSongs";
import { groupSongs } from "@/lib/songGrouping";
import ReportSongDialog from "../components/ReportSongDialog";
import SongRightsNotice from "../components/SongRightsNotice";

import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  CloudOff,
  Disc,
  Download,
  Filter,
  MoreHorizontal,
  Music,
  Search,
  Info,
  Heart,
  ListPlus,
  ListMusic,
  Plus,
  Check,
  Play,
  ArrowUpDown,
  ArrowDown,
  X,
  ArrowUp,
  Share2,
  Flag,
  ShieldCheck,
  Upload,
  Loader as SpinnerIcon,
} from "lucide-react";


const timeFilters = [
  { label: "All", days: null },
  // "New" is rank-based: the 15 most recently added songs (see lib/newSongs.js)
  { label: "New", days: null, recent: true },
  { label: "1 Month", days: 30 },
  { label: "3 Months", days: 90 },
];

const categories = ["All", "Worship", "Praise"];
const durations = ["All", "Long", "Short"];

const sortOptions = [
  { label: "Title", value: "title" },
  { label: "Artist", value: "author" },
  { label: "Date Added", value: "created_at" },
];

// The toolbar shows these; sortOptions keeps the longer wording for tooltips.
const sortLabels = { title: "Title", author: "Artist", created_at: "Date" };

// Fisher–Yates keeps "Play all" honest: every ordering is equally likely, and
// the shuffled order becomes the queue so Next walks the same random pass.
const shuffleSongs = (queue) => {
  const shuffled = [...queue];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const oneOf = (value, allowed, fallback) =>
  value != null && allowed.includes(value) ? value : fallback;

// The address bar is how a view outlives the tab: refresh, paste or share and
// you get the same slice of the catalogue. Anything a control could not have
// produced falls back to its default, so a hand-edited URL cannot put the page
// in a state its own UI cannot show.
const readViewFromUrl = (params) => ({
  searchValue: params.get("q") || "",
  activeFilter: oneOf(params.get("time"), timeFilters.map((f) => f.label), "All"),
  activeCategory: oneOf(params.get("type"), categories, "All"),
  activeDuration: oneOf(params.get("duration"), durations, "All"),
  sortBy: oneOf(params.get("sort"), sortOptions.map((o) => o.value), "title"),
  sortAsc: params.get("dir") !== "desc",
});

// Only what the listener changed is written, so the plain route stays plain.
const writeViewToUrl = (view, pathname) => {
  const params = new URLSearchParams();
  if (view.searchValue.trim()) params.set("q", view.searchValue.trim());
  if (view.activeFilter !== "All") params.set("time", view.activeFilter);
  if (view.activeCategory !== "All") params.set("type", view.activeCategory);
  if (view.activeDuration !== "All") params.set("duration", view.activeDuration);
  if (view.sortBy !== "title") params.set("sort", view.sortBy);
  if (!view.sortAsc) params.set("dir", "desc");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
};

// The panel's chips are the dense tier (.tap-sm, 34px on touch), not the
// generic 44px button floor: at four wrapped rows the floor made the filter
// panel taller than the few songs it was meant to reveal.
// Tailwind v4's preflight leaves buttons at cursor: default, so each control on
// this page opts into the pointer itself — a row that answers the pointer next to
// a toolbar that doesn't reads as half-disabled.
const Chip = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`tap-sm min-h-8.5 cursor-pointer whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
      active
        ? "border-accent bg-accent text-white shadow-2xs"
        : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 hover:border-neutral-300"
    }`}
  >
    {label}
  </button>
);

// Measured, not guessed: the ⋯ popup is ~235px tall and its top sits ~55px below
// the row's top edge (it hangs off the ⋯ cluster, which is centred in the row).
const MENU_ROOM = 380;

const SongRow = ({ song, onClick, isActive, isNew = false, onCategoryClick }) => {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const rowRef = useRef(null);
  const menuButtonRef = useRef(null);
  const menuRef = useRef(null);
  const [isSaved, setIsSaved] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showRights, setShowRights] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [downloadStatus, setDownloadStatus] = useState("idle");
  const [downloadError, setDownloadError] = useState("");
  const [shareFeedback, setShareFeedback] = useState("");
  // Decided when the menu opens, from where this row actually sits. The old rule
  // flipped only the last two rows of the last group, so a menu opened anywhere
  // else could land under the floating player.
  const [menuUp, setMenuUp] = useState(false);
  const dlTimeoutRef = useRef(null);
  const shareTimeoutRef = useRef(null);
  const menuId = `song-menu-${song.id}`;

  const menuPos = menuUp ? "bottom-0 mb-10" : "top-0 mt-10";

  // `#app-scroll` reserves the player's and the bottom nav's height as its own
  // bottom padding, so that number is already the area a menu must not open into.
  // The test is against the row's *top*, because that is where the popup hangs
  // from: comparing the bottom flipped rows in the upper half of the screen, whose
  // menus then went off the top instead.
  const openMenu = () => {
    const row = rowRef.current;
    if (row) {
      const scroller = row.closest("#app-scroll");
      const reserved = scroller
        ? parseFloat(window.getComputedStyle(scroller).paddingBottom) || 0
        : 0;
      setMenuUp(row.getBoundingClientRect().top + MENU_ROOM > window.innerHeight - reserved);
    }
    setShowMenu(true);
    setShowInfo(false);
    setShowRights(false);
    setShowPlaylists(false);
  };

  const closeMenus = () => {
    setShowMenu(false);
    setShowInfo(false);
    setShowRights(false);
    setShowPlaylists(false);
  };

  // Escape belongs to whichever popup is open: the page-level handler clears the
  // search, and leaving a menu should never also wipe the query.
  useEffect(() => {
    if (!showMenu && !showInfo && !showRights && !showPlaylists && !showReport) return;
    const handleEscape = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setShowMenu(false);
      setShowInfo(false);
      setShowRights(false);
      setShowPlaylists(false);
      setShowReport(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showMenu, showInfo, showRights, showPlaylists, showReport]);

  // role="menu" promises arrow keys, so they move between the items rather than
  // leaving the popup to tab order alone.
  const onMenuKeyDown = (e) => {
    const items = menuRef.current
      ? [...menuRef.current.querySelectorAll('[role="menuitem"]')]
      : [];
    if (items.length === 0) return;
    const at = items.indexOf(document.activeElement);
    const move = (next) => {
      e.preventDefault();
      items[(next + items.length) % items.length]?.focus();
    };
    if (e.key === "ArrowDown") move(at + 1);
    else if (e.key === "ArrowUp") move(at <= 0 ? -1 : at - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(items.length - 1);
    else if (e.key === "Tab") closeMenus();
  };


  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};
    import("@/lib/downloadManager")
      .then(({ isSongDownloaded, onDownloadsChanged }) => {
        if (cancelled) return;
        const sync = () => {
          setDownloadStatus((current) => {
            if (current === "downloading") return current;
            return isSongDownloaded(song.id) ? "downloaded" : "idle";
          });
        };
        sync();
        unsubscribe = onDownloadsChanged(sync);
      })
      .catch((error) => console.error("Unable to check download status:", error));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [song.id]);

  useEffect(() => {
    return () => clearTimeout(dlTimeoutRef.current);
  }, []);

  useEffect(() => {
    return () => clearTimeout(shareTimeoutRef.current);
  }, []);

  const handleShare = async (e) => {
    e.stopPropagation();
    try {
      const { shareSong } = await import("@/lib/share");
      const result = await shareSong(song);
      if (result === "copied") {
        setShareFeedback("Link copied!");
        clearTimeout(shareTimeoutRef.current);
        shareTimeoutRef.current = setTimeout(() => setShareFeedback(""), 2000);
      } else if (result === "failed") {
        setShareFeedback("Share failed");
        clearTimeout(shareTimeoutRef.current);
        shareTimeoutRef.current = setTimeout(() => setShareFeedback(""), 2000);
      } else {
        setShowMenu(false);
      }
    } catch (error) {
      console.error("Unable to share song:", error);
    }
  };

  const toggleDownload = async (e) => {
    e.stopPropagation();
    if (song.download_allowed === false) {
      setDownloadStatus("error");
      setDownloadError("Streaming only");
      clearTimeout(dlTimeoutRef.current);
      dlTimeoutRef.current = setTimeout(() => { setDownloadStatus("idle"); setDownloadError(""); }, 3000);
      return;
    }
    if (downloadStatus === "downloaded") {
      try {
        const { removeDownload } = await import("@/lib/downloadManager");
        await removeDownload(song.id);
        setDownloadStatus("idle");
        setShowMenu(false);
      } catch (err) {
        console.error("Unable to remove download:", err);
        setDownloadStatus("error");
        setDownloadError("Remove failed");
        clearTimeout(dlTimeoutRef.current);
        dlTimeoutRef.current = setTimeout(() => { setDownloadStatus("idle"); setDownloadError(""); }, 3000);
      }
      return;
    }
    setDownloadStatus("downloading");
    setDownloadError("");
    clearTimeout(dlTimeoutRef.current);
    try {
      const { downloadSong } = await import("@/lib/downloadManager");
      await downloadSong(song);
      setDownloadStatus("downloaded");
      setShowMenu(false);
    } catch (err) {
      setDownloadStatus("error");
      setDownloadError(err.message === "Storage is full" ? "Storage is full" : "Download failed");
      dlTimeoutRef.current = setTimeout(() => { setDownloadStatus("idle"); setDownloadError(""); }, 3000);
    }
  };

  useEffect(() => {
    if (!showMenu && !showInfo && !showRights && !showPlaylists) return;

    const handleClickOutside = (e) => {
      if (rowRef.current && !rowRef.current.contains(e.target)) {
        setShowMenu(false);
        setShowInfo(false);
        setShowRights(false);
        setShowPlaylists(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu, showInfo, showRights, showPlaylists]);

  useEffect(() => {
    if (!user) {
      setIsSaved(false);
      return;
    }

    apiFetch(`/api/data/saved_songs?song_id=${song.id}`)
      .then((data) => setIsSaved(data && data.length > 0))
      .catch((error) => console.error("Unable to check saved song:", error));
  }, [user, song.id]);

  useEffect(() => {
    if (showPlaylists && user) {
      apiFetch("/api/data/playlists?columns=id,name&order=created_at&ascending=false")
        .then((data) => setPlaylists(data || []))
        .catch((error) => console.error("Unable to load playlists:", error));
    }
  }, [showPlaylists, user]);

  const addToPlaylist = async (e, playlistId) => {
    e.stopPropagation();
    try {
      const existing = await apiFetch(`/api/data/playlist_songs?playlist_id=${playlistId}&song_id=${song.id}`);
      if (existing && existing.length > 0) return;
      await apiFetch("/api/data/playlist_songs", {
        method: "POST",
        body: JSON.stringify({ playlist_id: playlistId, song_id: song.id }),
      });
    } catch (error) {
      console.error("Unable to add song to playlist:", error);
    }
  };

  const createAndAdd = async (e) => {
    e.stopPropagation();
    const name = newPlaylistName.trim();
    if (!name || !user) return;

    try {
      const pl = await apiFetch("/api/data/playlists", {
        method: "POST",
        body: JSON.stringify({ name, user_id: user.id }),
      });

      if (pl) {
        await apiFetch("/api/data/playlist_songs", {
          method: "POST",
          body: JSON.stringify({ playlist_id: pl.id, song_id: song.id }),
        });
        setNewPlaylistName("");
        setShowPlaylists(false);
      }
    } catch (error) {
      console.error("Unable to create playlist:", error);
    }
  };

  const toggleSave = async (e) => {
    e.stopPropagation();
    if (!user) {
      router.push(`/auth?redirectTo=${encodeURIComponent(pathname)}`);
      return;
    }

    try {
      if (isSaved) {
        await apiFetch(`/api/data/saved_songs?song_id=${song.id}`, { method: "DELETE" });
        setIsSaved(false);
      } else {
        await apiFetch("/api/data/saved_songs", {
          method: "POST",
          body: JSON.stringify({ user_id: user.id, song_id: song.id }),
        });
        setIsSaved(true);
      }
      setShowMenu(false);
    } catch (error) {
      console.error("Unable to update saved song:", error);
    }
  };

  return (
    <div
      ref={rowRef}
      style={{ zIndex: showMenu || showInfo || showRights || showPlaylists ? 40 : undefined }}
      onMouseEnter={() => prefetchSongAudio(song)}
      className={`group relative flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors duration-150 sm:px-3 sm:py-2.5 sm:gap-3.5 ${
        isActive ? "bg-accent/[0.07]" : "hover:bg-neutral-50 active:bg-neutral-100"
      }`}
    >
      <div className="relative shrink-0">
        <SongAvatar title={song.title} variant="mono" size="md" />
        {downloadStatus === "downloaded" && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-white" />
        )}
      </div>

      <button
        type="button"
        onClick={onClick}
        aria-current={isActive ? "true" : undefined}
        aria-label={`${isActive ? "Playing" : "Play"}: ${song.title || "this song"}`}
        className="flex min-h-11 min-w-0 flex-1 cursor-pointer flex-col justify-center gap-0.5 rounded text-left after:absolute after:inset-0"
      >
        <span className="flex w-full min-w-0 items-center gap-1.5">
          <span className={`truncate text-sm font-semibold leading-5 tracking-tight ${isActive ? "text-accent" : "text-neutral-900 group-hover:text-accent"}`}>
            {song.title}
          </span>
          {isActive && (
            <span className="waveform shrink-0 text-accent" aria-hidden="true">
              <span /><span /><span /><span />
            </span>
          )}
          {isNew && !isActive && (
            <span className="shrink-0 rounded-full bg-ink/10 px-1.5 py-0.5 text-[10px] font-semibold leading-3 text-ink">
              New
            </span>
          )}
        </span>
        <span className="flex w-full min-w-0 items-center gap-1.5 text-xs leading-4 text-neutral-500">
          <span className="truncate font-medium">
            {song.author || "Unknown Artist"}
          </span>
          {song.category && (
            <>
              <span className="sm:hidden text-neutral-300" aria-hidden="true">•</span>
              <span className="sm:hidden shrink-0">
                {song.category}
              </span>
            </>
          )}
        </span>
      </button>

      {/* The ⋯ and category action sit above the play control's stretched layer,
          or the menu could never open. */}
      <div className="relative z-20 flex items-center gap-1.5">
        {song.category && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCategoryClick?.(song.category);
            }}
            aria-label={`Filter by ${song.category}`}
            className="hidden sm:inline-flex tap-sm cursor-pointer items-center rounded-full border border-neutral-200/80 bg-neutral-50 px-2.5 py-0.5 text-[11px] font-medium text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-100"
          >
            {song.category}
          </button>
        )}
        <button
          ref={menuButtonRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (showMenu) {
              setShowMenu(false);
              return;
            }
            openMenu();
          }}
          className="tap-sm flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-accent"
          title="More"
          aria-label={`More actions for ${song.title || "this song"}`}
          aria-haspopup="menu"
          aria-expanded={showMenu}
          aria-controls={showMenu ? menuId : undefined}
        >
          <MoreHorizontal size={18} />
        </button>

        {showMenu && (
          <div
            id={menuId}
            ref={menuRef}
            role="menu"
            aria-label={`More actions for ${song.title || "this song"}`}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onMenuKeyDown}
            className={`absolute right-0 z-50 min-w-[210px] rounded-xl border border-neutral-100 bg-white p-2 shadow-lg ${menuPos}`}
          >
            <button
              role="menuitem"
              onClick={() => {
                setShowInfo(true);
                setShowRights(false);
                setShowMenu(false);
                setShowPlaylists(false);
              }}
              className="flex w-full cursor-pointer items-center gap-x-3 rounded-lg px-3 py-2.5 text-left text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
            >
              <Info size={15} className="text-neutral-400" />
              <span className="text-xs font-semibold">Compilation Details</span>
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setShowRights(true);
                setShowInfo(false);
                setShowPlaylists(false);
                setShowMenu(false);
              }}
              className="flex w-full cursor-pointer items-center gap-x-3 rounded-lg px-3 py-2.5 text-left text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
            >
              <ShieldCheck size={15} className="text-neutral-400" />
              <span className="text-xs font-semibold">Rights &amp; archive use</span>
            </button>
            <button
              role="menuitem"
              onClick={() => {
                if (!user) {
                  router.push(`/auth?redirectTo=${encodeURIComponent(pathname)}`);
                  return;
                }
                setShowPlaylists(true);
                setShowInfo(false);
                setShowRights(false);
                setShowMenu(false);
              }}
              className="flex w-full cursor-pointer items-center gap-x-3 rounded-lg px-3 py-2.5 text-left text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
            >
              <ListPlus size={15} className="text-neutral-400" />
              <span className="text-xs font-semibold">Add to Playlist</span>
            </button>
            {song.download_allowed !== false && (
              <button
                role="menuitem"
                onClick={toggleDownload}
                className="flex w-full cursor-pointer items-center gap-x-3 rounded-lg px-3 py-2.5 text-left text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
              >
                {downloadStatus === "downloading" ? (
                  <SpinnerIcon size={15} className="animate-spin text-neutral-400" />
                ) : downloadStatus === "downloaded" ? (
                  <Check size={15} className="text-green-500" strokeWidth={3} />
                ) : (
                  <Download size={15} className="text-neutral-400" />
                )}
                <span className={`text-xs font-semibold ${downloadStatus === "error" ? "text-red-500" : ""}`}>
                  {downloadStatus === "downloading" ? "Downloading..." : downloadStatus === "downloaded" ? "Remove Download" : downloadStatus === "error" ? downloadError : "Download for offline"}
                </span>
              </button>
            )}
            <button
              role="menuitem"
              onClick={handleShare}
              className="flex w-full cursor-pointer items-center gap-x-3 rounded-lg px-3 py-2.5 text-left text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
            >
              {shareFeedback ? (
                <Check size={15} className="text-green-500" strokeWidth={3} />
              ) : (
                <Share2 size={15} className="text-neutral-400" />
              )}
              <span className="text-xs font-semibold">
                {shareFeedback || "Share song"}
              </span>
            </button>
            <button
              role="menuitem"
              onClick={toggleSave}
              className="flex w-full cursor-pointer items-center gap-x-3 rounded-lg px-3 py-2.5 text-left text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
            >
              <Heart
                size={15}
                className={isSaved ? "text-neutral-900 fill-neutral-900" : "text-neutral-400"}
              />
              <span className="text-xs font-semibold">
                {isSaved ? "Remove from Library" : "Add to Library"}
              </span>
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setShowMenu(false);
                setShowReport(true);
              }}
              className="flex w-full cursor-pointer items-center gap-x-3 rounded-lg px-3 py-2.5 text-left text-red-600 transition hover:bg-red-50 hover:text-red-700"
            >
              <Flag size={15} className="text-red-500" />
              <span className="text-xs font-semibold">Report this song</span>
            </button>
          </div>
        )}
      </div>

      {showInfo && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute right-0 z-50 min-w-[260px] rounded-xl border border-neutral-100 bg-white p-5 shadow-lg ${menuPos}`}
        >
          <div className="flex flex-col gap-y-4">
            <div className="flex items-center justify-between border-b border-neutral-50 pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Compilation Details
              </h4>
              <button
                onClick={() => setShowInfo(false)}
                className="cursor-pointer text-neutral-300 transition hover:text-neutral-900"
              >
                <X size={14} />
              </button>
            </div>
            <div className="custom-scrollbar flex max-h-[250px] flex-col gap-y-4 overflow-y-auto pr-1">
              {song.original_songs && song.original_songs.length > 0 ? (
                song.original_songs.map((entry, i) => (
                  <div key={i} className="group/entry flex flex-col gap-y-1">
                    <p className="text-[14px] font-bold leading-tight text-neutral-900">
                      {entry.title || "Unknown Title"}
                    </p>
                    <p className="text-xs font-medium text-neutral-500">
                      Original Artist:{" "}
                      <span className="text-neutral-900">
                        {entry.artist || "Unknown"}
                      </span>
                    </p>
                  </div>
                ))
              ) : (
                <p className="py-2 text-xs italic text-neutral-400">
                  No original song details available.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {showRights && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute right-0 z-50 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-neutral-100 bg-white p-2 shadow-lg ${menuPos}`}
        >
          <SongRightsNotice song={song} compact />
        </div>
      )}

      {showPlaylists && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute right-0 z-50 min-w-[240px] rounded-xl border border-neutral-100 bg-white p-4 shadow-lg ${menuPos}`}
        >
          <div className="mb-3 flex items-center justify-between border-b border-neutral-50 pb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Add to Playlist
            </h4>
            <button
              onClick={() => setShowPlaylists(false)}
              className="cursor-pointer text-neutral-300 transition hover:text-neutral-900"
            >
              <X size={14} />
            </button>
          </div>
          <div className="custom-scrollbar flex max-h-[200px] flex-col gap-y-1 overflow-y-auto">
            {playlists.length === 0 ? (
              <p className="py-2 text-center text-xs italic text-neutral-400">
                No playlists yet
              </p>
            ) : (
              playlists.map((pl) => (
                <button
                  key={pl.id}
                  onClick={(e) => addToPlaylist(e, pl.id)}
                  className="flex w-full cursor-pointer items-center gap-x-3 rounded-lg px-3 py-2.5 text-left text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
                >
                  <ListMusic size={15} className="text-neutral-400" />
                  <span className="flex-1 truncate text-xs font-semibold">
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
                className="flex-1 rounded-lg border border-neutral-200/80 bg-neutral-50/60 px-3 py-2 text-xs font-medium outline-none transition placeholder:text-neutral-300 focus:border-neutral-300 focus:bg-white"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={createAndAdd}
                disabled={!newPlaylistName.trim()}
                className="flex-shrink-0 cursor-pointer rounded-lg bg-accent p-2 text-white transition hover:bg-accent/90 disabled:opacity-50"
                title="Create & Add"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      <ReportSongDialog
        open={showReport}
        onClose={() => setShowReport(false)}
        song={song}
      />
    </div>
  );
};

// How far down the list you are, drawn on the edge of the bar that belongs to
// the list. It used to be `fixed top-0`, which painted it across the app
// header — and the header now collapses away on a downward drag, so the line
// detached from the thing it described.
const ScrollProgress = ({ progress }) => {
  if (progress < 0.01) return null;
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 h-[2px] overflow-hidden rounded-b-xl">
      <div
        className="h-full bg-accent transition-[width] duration-150 ease-out"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  );
};

const ScrollToTop = ({ scrollY }) => {
  const { activeSong } = usePlayer();

  const scrollToTop = () => {
    document.getElementById("app-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (scrollY < 400) return null;

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={scrollToTop}
      className={`fixed z-50 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-accent text-white shadow-lg ring-4 ring-white transition hover:bg-accent/90 active:scale-95 left-4 lg:left-auto lg:right-8 ${
        activeSong ? "bottom-40 md:bottom-24" : "bottom-24 md:bottom-8"
      }`}
    >
      <ArrowUp size={18} />
    </button>
  );
};

export default function SongsView() {
  const {
    allSongs,
    setAllSongs,
    setActiveSong,
    activeSong,
    isLoading,
    setIsLoading,
  } = usePlayer();
  const { isAdmin } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The query string is read once, here, and written back on every change
  // below. Reading it through useSearchParams is what keeps the prerendered
  // route honest: the boundary in page.js means this component only ever runs
  // on the client, where the params are the ones in the address bar.
  const [view] = useState(() => readViewFromUrl(searchParams));
  const [searchValue, setSearchValue] = useState(view.searchValue);
  const [activeFilter, setActiveFilter] = useState(view.activeFilter);
  const [activeCategory, setActiveCategory] = useState(view.activeCategory);
  const [activeDuration, setActiveDuration] = useState(view.activeDuration);
  const [sortBy, setSortBy] = useState(view.sortBy);
  const [sortAsc, setSortAsc] = useState(view.sortAsc);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef(null);
  const sortTriggerRef = useRef(null);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [jumpLetter, setJumpLetter] = useState(null);
  const [activeGroupKey, setActiveGroupKey] = useState(null);
  const jumpTimeoutRef = useRef(null);
  const letterRefs = useRef({});
  const searchInputRef = useRef(null);
  const [scrollY, setScrollY] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);

  // The app header sits outside #app-scroll, so the top edge of the scroll
  // container is already below it. The sticky letter chips and the alphabet
  // rail park 8px under that edge: flush against it read as part of the nav
  // bar, and the search/filter bar is page content now, so nothing above
  // these needs its height measured any more.
  const STICKY_TOP = 8;

  // On phones the index belongs under the thumb: anchored just clear of the
  // player/nav stack instead of vertically centered in the list viewport.
  // Desktop keeps the centered position it already had.
  const MOBILE_RAIL_BOTTOM_GAP = 12;

  // Track the app scroll container (layout scrolls in #app-scroll, not window)
  // for the progress bar + scroll-to-top button.
  useEffect(() => {
    const scroller = document.getElementById("app-scroll");
    if (!scroller) return;
    const handleScroll = () => {
      const max = scroller.scrollHeight - scroller.clientHeight;
      setScrollY(scroller.scrollTop);
      setScrollProgress(max > 0 ? Math.min(scroller.scrollTop / max, 1) : 0);
    };
    handleScroll();
    scroller.addEventListener("scroll", handleScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", handleScroll);
  }, []);

  // Writing through the History API rather than the router: a soft navigation
  // on every keystroke would refetch the route and re-suspend the list, while
  // all this needs is the address bar to match what is on screen. The existing
  // history state is passed back untouched so the router keeps its own record
  // of this entry.
  useEffect(() => {
    const url = writeViewToUrl(
      { searchValue, activeFilter, activeCategory, activeDuration, sortBy, sortAsc },
      pathname,
    );
    if (url === `${window.location.pathname}${window.location.search}`) return;
    window.history.replaceState(window.history.state, "", url);
  }, [searchValue, activeFilter, activeCategory, activeDuration, sortBy, sortAsc, pathname]);

  // A failed load used to be a dead end: the page said "check your connection"
  // and offered no way to check it again short of reloading the whole app.
  const retryLoad = useCallback(() => {
    setLoadError(false);
    setLoadAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchSongs = async () => {
      try {
        setIsLoading(true);

        const data = await apiFetch("/api/data/songs?order=title&ascending=true");

        if (!cancelled && data) {
          setAllSongs(data);
        }
      } catch (error) {
        console.error("Error:", error);
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchSongs();
    return () => {
      cancelled = true;
    };
  }, [setAllSongs, setIsLoading, loadAttempt]);

  const newSongIds = useMemo(
    () => new Set(getNewestSongs(allSongs || []).map((s) => s.id)),
    [allSongs]
  );

  const filteredSongs = useMemo(() => {
    let songs = [...(allSongs || [])];

    if (searchValue.trim()) {
      const query = searchValue.trim().toLowerCase();
      songs = songs.filter(
        (song) =>
          song.title?.toLowerCase().includes(query) ||
          song.author?.toLowerCase().includes(query)
      );
    }

    if (activeFilter !== "All") {
      const filterObj = timeFilters.find((f) => f.label === activeFilter);
      if (filterObj?.recent) {
        // Rank against the full catalogue, just like the NEW badges and stats.
        songs = songs.filter((song) => newSongIds.has(song.id));
      } else if (filterObj?.days) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - filterObj.days);
        songs = songs.filter((song) => new Date(song.created_at) >= cutoff);
      }
    }

    if (activeCategory !== "All") {
      songs = songs.filter(
        (song) =>
          (song.category || "Worship").trim().toLowerCase() ===
          activeCategory.toLowerCase()
      );
    }

    if (activeDuration !== "All") {
      songs = songs.filter(
        (song) => (song.duration || "Long") === activeDuration
      );
    }

    const sorted = songs.sort((a, b) => {
      const aVal = (a[sortBy] || "").toString().toLowerCase();
      const bVal = (b[sortBy] || "").toString().toLowerCase();
      const cmp = aVal.localeCompare(bVal);
      return sortAsc ? cmp : -cmp;
    });

    return sorted;
  }, [allSongs, newSongIds, searchValue, activeFilter, activeCategory, activeDuration, sortBy, sortAsc]);

  const songGroups = useMemo(
    () => groupSongs(filteredSongs, sortBy),
    [filteredSongs, sortBy]
  );

  useEffect(() => {
    const scroller = document.getElementById("app-scroll");
    if (!scroller) return;
    const updateActiveGroup = () => {
      const top = scroller.getBoundingClientRect().top + STICKY_TOP + 34;
      let key = songGroups[0]?.key;
      for (const group of songGroups) {
        const element = letterRefs.current[group.key];
        if (element && element.getBoundingClientRect().top <= top) key = group.key;
      }
      setActiveGroupKey(key || null);
    };
    updateActiveGroup();
    scroller.addEventListener("scroll", updateActiveGroup, { passive: true });
    return () => scroller.removeEventListener("scroll", updateActiveGroup);
  }, [songGroups, STICKY_TOP]);

  // The rail is only a few characters wide, so date groups show the month and
  // the sticky pill carries the year.
  const railLabel = (group) => {
    if (sortBy !== "created_at") return group.label;
    return group.key === "unknown" ? "?" : group.label.slice(0, 3);
  };
  const hasFilters =
    searchValue.trim() ||
    activeFilter !== "All" ||
    activeCategory !== "All" ||
    activeDuration !== "All";
  // The button is named "Filters", so it counts the panel's three groups and not
  // the query: a search alone used to read "Filters (1)" while every chip inside
  // the panel still said All. `hasFilters` above still includes the search,
  // because that is what the Clear strip undoes.
  const activeFilterCount = [
    activeFilter !== "All" ? activeFilter : null,
    activeCategory !== "All" ? activeCategory : null,
    activeDuration !== "All" ? activeDuration : null,
  ].filter(Boolean).length;

  // One line each in the open panel; keeping them as a list is what lets a
  // label sit beside its chips instead of above them.
  const filterGroups = [
    {
      title: "Time",
      options: timeFilters.map((filter) => filter.label),
      value: activeFilter,
      setValue: setActiveFilter,
    },
    { title: "Type", options: categories, value: activeCategory, setValue: setActiveCategory },
    { title: "Duration", options: durations, value: activeDuration, setValue: setActiveDuration },
  ];

  const stats = useMemo(() => {
    const list = allSongs || [];
    return {
      total: list.length,
      artists: new Set(list.map((s) => s.author).filter(Boolean)).size,
      new: getNewestSongs(list).length,
    };
  }, [allSongs]);

  const scrollToLetter = useCallback((letter, behavior = "smooth") => {
    setJumpLetter(letter);
    clearTimeout(jumpTimeoutRef.current);
    jumpTimeoutRef.current = setTimeout(() => setJumpLetter(null), 800);

    const el = letterRefs.current[letter];
    if (el) {
      el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : behavior, block: "start" });
    }
  }, []);

  useEffect(() => {
    return () => clearTimeout(jumpTimeoutRef.current);
  }, []);

  // The rail is half-height now, so the letters that do not fit scroll inside
  // it. A mouse still scrubs the column; touch keeps native vertical scrolling
  // and tap-to-jump, which is more useful than fighting the browser's pan.
  const railRef = useRef(null);
  const railLettersRef = useRef({});
  const railKeyRef = useRef(null);
  const [railScrubbing, setRailScrubbing] = useState(false);
  const listRowRef = useRef(null);
  const [railBox, setRailBox] = useState(null);

  useLayoutEffect(() => {
    const row = listRowRef.current;
    const scroller = document.getElementById("app-scroll");
    if (!row || !scroller) return;
    const chrome = ["bottom-nav", "now-playing-bar", "mobile-now-playing-bar"]
      .map((id) => document.getElementById(id)).filter(Boolean);
    const viewport = window.visualViewport;
    const measureRail = () => {
      const rowRect = row.getBoundingClientRect();
      const scRect = scroller.getBoundingClientRect();
      const top = Math.max(scRect.top, viewport?.offsetTop || 0) + STICKY_TOP;
      let bottom = Math.min(scRect.bottom, viewport ? viewport.offsetTop + viewport.height : window.innerHeight);
      for (const element of chrome) {
        const rect = element.getBoundingClientRect();
        if (rect.height > 0) bottom = Math.min(bottom, rect.top);
      }
      const available = Math.max(0, bottom - STICKY_TOP - top);
      // Half the old full-list height, with a floor so a short catalogue still
      // gets a usable track. The remaining letters scroll inside the rail.
      const visibleGroups = Math.max(4, Math.ceil(songGroups.length / 2));
      const height = Math.min(available, visibleGroups * 24 + 12);
      const isPhone = window.matchMedia("(max-width: 639px)").matches;
      // Clamp to the track's top on short viewports where the whole rail fits
      // in the available space; otherwise it would creep into the app bar.
      const railTop = isPhone
        ? Math.max(top, bottom - MOBILE_RAIL_BOTTOM_GAP - height)
        : top + (available - height) / 2;
      const next = {
        top: railTop,
        height,
        right: Math.max(8, window.innerWidth - rowRect.right),
      };
      setRailBox((previous) => previous && previous.top === next.top && previous.height === next.height && previous.right === next.right ? previous : next);
    };
    measureRail();
    const observer = new ResizeObserver(measureRail);
    [scroller, row, ...chrome].forEach((element) => observer.observe(element));
    window.addEventListener("resize", measureRail);
    viewport?.addEventListener("resize", measureRail);
    viewport?.addEventListener("scroll", measureRail);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measureRail);
      viewport?.removeEventListener("resize", measureRail);
      viewport?.removeEventListener("scroll", measureRail);
    };
  }, [activeSong, isLoading, songGroups.length, STICKY_TOP]);

  // Scrolling the list changes which group is current; bring that letter back
  // into the shortened track so the highlight never hides below the fold.
  const revealRailLetter = useCallback((key, behavior = "smooth") => {
    const rail = railRef.current;
    const el = railLettersRef.current[key];
    if (!rail || !el) return;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    const viewTop = rail.scrollTop;
    const viewBottom = viewTop + rail.clientHeight;
    const next = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : behavior;
    if (top < viewTop) rail.scrollTo({ top: Math.max(0, top), behavior: next });
    else if (bottom > viewBottom) rail.scrollTo({ top: bottom - rail.clientHeight, behavior: next });
  }, []);

  useEffect(() => {
    if (!activeGroupKey) return;
    revealRailLetter(activeGroupKey);
  }, [activeGroupKey, revealRailLetter]);

  const jumpFromClientY = useCallback((clientY) => {
    const rail = railRef.current;
    if (!rail) return;

    let nearest = null;
    let nearestGap = Infinity;
    for (const el of Object.values(railLettersRef.current)) {
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const gap = Math.abs(rect.top + rect.height / 2 - clientY);
      if (gap < nearestGap) {
        nearestGap = gap;
        nearest = el.dataset.railKey;
      }
    }
    if (nearest && nearest !== railKeyRef.current) {
      railKeyRef.current = nearest;
      scrollToLetter(nearest, "instant");
      revealRailLetter(nearest, "instant");
    }
  }, [scrollToLetter, revealRailLetter]);

  // A mouse keeps its clicks and a drag that leaves the column simply stops: no
  // pointer capture, because capturing retargets the release away from the letter
  // and throws for a pointer that is already gone.
  const stopRailScrub = () => {
    setRailScrubbing(false);
    railKeyRef.current = null;
  };

  // The sort field used to cycle Title → Artist → Date on every tap: reaching
  // "Date" meant tapping past two fields you did not want, and nothing on the
  // control admitted it would cycle. It opens the three options instead.
  // Listens on document, like the row menus, so it answers Escape before the
  // page-level window handler can read it as "clear the search".
  useEffect(() => {
    if (!sortOpen) return;
    // Open on the choice in force, so the arrow keys move from somewhere real
    // and a screen reader hears what is already selected.
    sortRef.current?.querySelector('[aria-checked="true"]')?.focus();
    const onPointerDown = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setSortOpen(false);
      sortTriggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [sortOpen]);

  const onSortMenuKeyDown = (e) => {
    const items = sortRef.current
      ? [...sortRef.current.querySelectorAll('[role="menuitemradio"]')]
      : [];
    if (items.length === 0) return;
    const at = items.indexOf(document.activeElement);
    const move = (next) => {
      e.preventDefault();
      items[(next + items.length) % items.length]?.focus();
    };
    if (e.key === "ArrowDown") move(at + 1);
    else if (e.key === "ArrowUp") move(at <= 0 ? -1 : at - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(items.length - 1);
    else if (e.key === "Tab") {
      // Tab leaves the menu, so focus has to land on something that still
      // exists — otherwise it falls to the body and the next Tab restarts the
      // page from the top.
      setSortOpen(false);
      sortTriggerRef.current?.focus();
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        const activeTag = document.activeElement?.tagName;
        if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape") {
        // A row's own popup already handled this one (it preventDefaults so the
        // query stays put while the menu closes).
        if (e.defaultPrevented) return;
        if (searchValue) {
          setSearchValue("");
        }
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchValue]);

  const handleCategoryClick = useCallback((category) => {
    setActiveCategory(category);
    setFiltersOpen(true);
  }, []);

  const playAll = useCallback(() => {
    if (filteredSongs.length === 0) return;
    // Search and filters still decide the pool; only its order is randomized.
    const shuffled = shuffleSongs(filteredSongs);
    setActiveSong(shuffled[0], shuffled);
  }, [filteredSongs, setActiveSong]);

  // One handler for getting back to the whole catalogue. The toolbar used to
  // offer three ways out that each cleared a different subset — Reset left the
  // search alone, the empty state's button cleared everything, and "Clear
  // search" duplicated the ✕ already inside the field.
  const clearAll = useCallback(() => {
    setSearchValue("");
    setActiveFilter("All");
    setActiveCategory("All");
    setActiveDuration("All");
  }, []);

  // "A-Z" says nothing about a date sort, where the direction is oldest/newest.
  const byDate = sortBy === "created_at";
  const dirLabel = byDate ? (sortAsc ? "Old" : "New") : sortAsc ? "A-Z" : "Z-A";
  const dirName = byDate
    ? sortAsc
      ? "Sorted oldest first, tap for newest first"
      : "Sorted newest first, tap for oldest first"
    : sortAsc
      ? "Sorted A to Z, tap for Z to A"
      : "Sorted Z to A, tap for A to Z";

  // #app-scroll already reserves the player and the bottom nav as its own bottom
  // padding (176px). A second, page-level reserve on top of it left 319–383px of
  // blank white below the last row, so the list read as unfinished. This adds
  // only breathing room and the iOS inset the scroller's fixed padding cannot
  // know about.
  return (
    <main className="min-h-[90vh] bg-white px-4 sm:px-6 md:px-8 pt-4 md:pt-5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
      <div className="mx-auto max-w-5xl space-y-3 md:space-y-5">
        {/* The index is vertically centred inside the list viewport, well below
            this header, so the title and primary action can use the full width
            on phones. The rail gutter returns at sm and up where it already
            looked settled. */}
        <section className="flex items-center justify-between gap-3 sm:pr-8">
          <div className="min-w-0">
            <h1 className="page-title">
              Songs
            </h1>
            <p className="mt-1 text-xs leading-5 font-medium text-neutral-500 sm:text-sm">
              {isLoading ? (
                <span className="inline-flex items-center gap-1.5 text-neutral-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                  Loading library…
                </span>
              ) : hasFilters ? (
                // One count, in the one place it is read: while a filter is on,
                // the catalogue breakdown is not what the listener is checking.
                <>
                  <span className="font-bold text-neutral-800">{filteredSongs.length}</span> of{" "}
                  {stats.total} {stats.total === 1 ? "track" : "tracks"}
                </>
              ) : (
                <>
                  <span className="font-bold text-neutral-800">{stats.total}</span>{" "}
                  {stats.total === 1 ? "track" : "tracks"}
                  <span className="text-neutral-300"> • </span>
                  <span className="font-bold text-neutral-800">{stats.artists}</span>{" "}
                  {stats.artists === 1 ? "artist" : "artists"}
                  {stats.new > 0 && (
                    <>
                      <span className="text-neutral-300"> • </span>
                      <span className="font-bold text-accent">{stats.new} new</span>
                    </>
                  )}
                </>
              )}
            </p>
          </div>
          {filteredSongs.length > 0 && (
            <button
              type="button"
              onClick={playAll}
              title="Play all in a random order"
              className="btn-primary shrink-0 cursor-pointer px-4 active:scale-95 sm:px-5"
            >
              <Play size={14} fill="currentColor" />
              {/* The count is already the subtitle's job, and it is the same
                  number whether a filter is on or not. What changes is what the
                  button plays, so the label says that instead. */}
              <span>{hasFilters ? "Play results" : "Play all"}</span>
            </button>
          )}
        </section>

      {/* Search / Filter Bar — page content, it scrolls away with the list.
          Like the header, it only gives up width for the rail from sm up. */}
      <div className="relative sm:mr-8">
        <div className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="search-field flex h-11 min-h-11 min-w-0 shrink-0 sm:flex-1 items-center gap-2 rounded-xl border border-neutral-200/80 bg-neutral-50 px-3 text-neutral-500 transition focus-within:border-neutral-300 focus-within:bg-white">
              <Search size={15} className="shrink-0 text-neutral-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search songs or artists..."
                aria-label="Search songs or artists"
                aria-keyshortcuts="/"
                enterKeyHint="search"
                autoComplete="off"
                spellCheck={false}
                className="w-full min-w-0 flex-1 bg-transparent text-base sm:text-sm font-medium text-neutral-900 outline-none placeholder:text-neutral-400"
              />
              {/* The page already answers "/" — the header advertises ⌘K the same
                  way, so the shortcut is legible instead of folklore. Phones have
                  no keyboard to press it on, hence max-md:hidden. */}
              {!searchValue && (
                <kbd
                  aria-hidden="true"
                  className="max-md:hidden shrink-0 rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-xs font-semibold text-neutral-400"
                >
                  /
                </kbd>
              )}
              {searchValue && (
                <button
                  type="button"
                  onClick={() => setSearchValue("")}
                  aria-label="Clear search"
                  className="tap-sm flex h-8.5 w-8.5 shrink-0 cursor-pointer items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-200"
                >
                  <X size={10} strokeWidth={3} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Sort: the field opens its three options, the direction stays a
                  one-tap toggle because it is the half you flip repeatedly. The
                  container cannot clip (overflow-hidden) any more — the menu hangs
                  out of it — so each button carries its own corner radius. */}
              <div
                ref={sortRef}
                className="relative inline-flex shrink-0 items-stretch rounded-lg border border-neutral-200/80 bg-white"
              >
              <button
                ref={sortTriggerRef}
                type="button"
                onClick={() => setSortOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={sortOpen}
                aria-controls={sortOpen ? "songs-sort-menu" : undefined}
                className="tap-sm inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-l-lg px-3 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-900"
                aria-label={`Sort by ${sortOptions.find((o) => o.value === sortBy)?.label}`}
                title={`Sort by: ${sortOptions.find((o) => o.value === sortBy)?.label}`}
              >
                <ArrowUpDown size={13} className="max-sm:hidden" />
                {/* The field name stays on the phone: an unlabelled ⇅ next to an
                    unlabelled arrow is two mystery icons, which reads as clutter
                    rather than as a control. */}
                <span>{sortLabels[sortBy]}</span>
                <ChevronDown
                  size={12}
                  className={`shrink-0 text-neutral-400 transition-transform duration-200 ${sortOpen ? "rotate-180" : ""}`}
                />
              </button>
              <button
                type="button"
                onClick={() => setSortAsc((prev) => !prev)}
                aria-label={dirName}
                title={sortAsc ? "Ascending" : "Descending"}
                className="tap-sm flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-r-lg border-l border-neutral-200/80 px-2.5 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-900"
              >
                {sortAsc ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                <span className="hidden sm:inline">{dirLabel}</span>
              </button>

              {sortOpen && (
                <div
                  id="songs-sort-menu"
                  role="menu"
                  aria-label="Sort songs by"
                  onKeyDown={onSortMenuKeyDown}
                  className="absolute right-0 top-full z-50 mt-1.5 min-w-[172px] rounded-xl border border-neutral-100 bg-white p-1.5 shadow-lg"
                >
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      role="menuitemradio"
                      aria-checked={sortBy === option.value}
                      onClick={() => {
                        setSortBy(option.value);
                        // A date sort reads newest-first, a text sort A-Z; those
                        // are the defaults the old cycle applied on the way past.
                        setSortAsc(option.value !== "created_at");
                        setSortOpen(false);
                        sortTriggerRef.current?.focus();
                      }}
                      className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
                    >
                      <span>{option.label}</span>
                      {sortBy === option.value && <Check size={14} strokeWidth={3} className="text-accent" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setFiltersOpen((prev) => !prev)}
              aria-expanded={filtersOpen}
              aria-controls="songs-filter-panel"
              className={`tap-sm inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition ${
                activeFilterCount > 0
                  ? "border-accent bg-accent/8 text-accent hover:bg-accent/15"
                  : "border-neutral-200/80 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
              }`}
            >
              <Filter size={13} className="max-sm:hidden" />
              <span>Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}</span>
              {filtersOpen ? <ChevronUp size={14} className="shrink-0" /> : <ChevronDown size={14} className="shrink-0" />}
            </button>
            </div>
          </div>

          {hasFilters && (
            <div className="flex flex-wrap items-center gap-2 px-1 pt-2.5">
              {/* One way out, not three. The number of things it undoes is the
                  same number the Filters button above already carries, so this
                  control does not repeat it. */}
              <button
                type="button"
                onClick={clearAll}
                className="tap-sm inline-flex h-8.5 cursor-pointer items-center gap-1 rounded-full px-2 text-xs font-medium text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900"
              >
                <X size={10} strokeWidth={3} />
                Clear
              </button>
            </div>
          )}
        </div>

        <ScrollProgress progress={scrollProgress} />
      </div>

      {filtersOpen && (
          <section id="songs-filter-panel" className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 shadow-2xs sm:mr-8 md:px-5 md:py-4">
            {/* One line per filter, with its name in front of the chips. The
                stacked version — label alone on a line above each group —
                measured 225px on a phone, so opening it hid a third of the
                screen before a single song. */}
            <div className="flex flex-col gap-1.5">
              {filterGroups.map((group) => (
                <div key={group.title} className="flex items-start gap-2">
                  <p className="w-14 shrink-0 pt-2 text-xs font-medium text-neutral-500">
                    {group.title}
                  </p>
                  <div className="flex flex-1 flex-wrap gap-1.5">
                    {group.options.map((option) => (
                      <Chip
                        key={option}
                        label={option}
                        active={group.value === option}
                        onClick={() => group.setValue(option)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
      )}

      {/* Song List + Alphabet Jump */}
      <div className="relative">
        {isLoading ? (
          <PageSkeleton />
        ) : songGroups.length > 0 ? (
          <div ref={listRowRef} className="flex gap-1.5 sm:gap-4">
            {/* Songs */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-y-3 sm:gap-y-4 md:gap-y-6">
                {songGroups.map((group) => (
                  <div
                    key={group.key}
                    ref={(el) => { letterRefs.current[group.key] = el; }}
                    style={{ scrollMarginTop: STICKY_TOP + 34 }}
                    className="flex flex-col gap-y-1"
                  >
                    <div
                      style={{ top: STICKY_TOP }}
                      className="sticky z-10 -mx-1.5 flex items-center gap-2 border-b border-neutral-200/70 bg-white/95 px-1.5 py-1.5 backdrop-blur-md"
                    >
                      {sortBy === "created_at" ? (
                        <span className="rounded-full bg-accent/[0.07] px-2.5 py-1 text-xs font-bold text-accent">
                          {group.label}
                        </span>
                      ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/[0.07] text-xs font-bold text-accent">
                          {group.label}
                        </div>
                      )}
                      <span className="text-xs font-medium text-neutral-500">
                        {group.songs.length} {group.songs.length === 1 ? "song" : "songs"}
                      </span>
                    </div>
                    {/* A flat list with hairlines, not a stack of bordered cards:
                        forty boxes each with a border and a shadow is what made
                        the page read as clutter. */}
                    <div className="flex flex-col divide-y divide-neutral-200/70">
                      {group.songs.map((song) => (
                          <SongRow
                            key={song.id}
                            song={song}
                            isActive={activeSong?.id === song.id}
                            isNew={newSongIds.has(song.id)}
                            onClick={() => setActiveSong(song, filteredSongs)}
                            onCategoryClick={handleCategoryClick}
                          />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* The list ends on a line, not on blank white — the same terminus
                  the home feed uses. Back to top is already floating at this
                  scroll depth, so it is not offered a second time here. */}
              <div className="flex flex-col items-center gap-2.5 pt-6 pb-1 text-center">
                <div className="flex w-full items-center gap-3">
                  <div className="h-px flex-1 bg-neutral-200" />
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 text-neutral-400">
                    <Music size={12} />
                  </div>
                  <div className="h-px flex-1 bg-neutral-200" />
                </div>
                <div>
                  <p className="text-xs font-bold tracking-tight text-neutral-900">
                    You&apos;ve reached the end
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-neutral-500">
                    Thanks for worshipping with us today.
                  </p>
                </div>
              </div>
            </div>

            {/* Alphabet Jump Bar — a themed index track pinned to the list's
                right edge. It is half its former height; letters that do not
                fit scroll inside it with the scrollbar hidden. The placeholder
                keeps the rows clear of it. */}
            <div aria-hidden="true" className="w-6 shrink-0 sm:w-7" />
            {railBox && railBox.height > 0 && songGroups.length > 1 && (
              <div
                ref={railRef}
                style={{
                  top: railBox.top,
                  height: railBox.height,
                  right: railBox.right,
                  touchAction: "pan-y",
                }}
                aria-label={sortBy === "created_at" ? "Date index" : "Alphabet index"}
                role="group"
                onPointerDown={(e) => {
                  // Touch keeps native vertical scroll; a mouse still scrubs.
                  if (e.pointerType !== "mouse" || e.button !== 0) return;
                  setRailScrubbing(true);
                  jumpFromClientY(e.clientY);
                }}
                onPointerMove={(e) => {
                  if (railScrubbing) jumpFromClientY(e.clientY);
                }}
                onPointerUp={stopRailScrub}
                onPointerLeave={stopRailScrub}
                onPointerCancel={stopRailScrub}
                className="songs-index fixed z-30 flex w-6 select-none flex-col items-stretch justify-start overflow-y-auto rounded-full bg-neutral-100/80 py-1.5 sm:w-7"
              >
                {songGroups.map((group) => (
                  <button
                    key={group.key}
                    type="button"
                    data-rail-key={group.key}
                    ref={(el) => { railLettersRef.current[group.key] = el; }}
                    aria-label={`Jump to ${group.label}`}
                    aria-current={(jumpLetter || activeGroupKey) === group.key ? "location" : undefined}
                    onClick={() => scrollToLetter(group.key)}
                    className={`flex h-6 min-h-0 w-full shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-full text-[11px] font-bold leading-none transition-colors duration-150 select-none ${
                      (jumpLetter || activeGroupKey) === group.key
                        ? "bg-accent text-white"
                        : "text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800 active:bg-neutral-200 active:text-neutral-800"
                    }`}
                  >
                    {railLabel(group)}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-100 border border-neutral-200">
              {loadError ? (
                <CloudOff className="text-accent" size={24} />
              ) : hasFilters ? (
                <Search className="text-accent" size={24} />
              ) : (
                <Disc className="text-accent" size={24} />
              )}
            </div>
            <p
              role={loadError ? "alert" : undefined}
              className="text-base font-bold tracking-tight text-neutral-900"
            >
              {loadError
                ? "Songs could not be loaded"
                : hasFilters
                  ? "No matching songs"
                  : isAdmin
                    ? "Your library is empty"
                    : "No songs yet"}
            </p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-neutral-500">
              {loadError
                ? "Check your connection and try again."
                : hasFilters
                  ? "Try adjusting your search or clearing the filters."
                  : isAdmin
                    ? "Upload your first worship song and start building your collection. Songs will appear here automatically."
                    : "The collection is still being built. New recordings appear here as soon as they are added."}
            </p>
            {loadError ? (
              // A failed load is the one state that must offer its own way out:
              // reloading the app loses the queue and the scroll position.
              <button
                type="button"
                onClick={retryLoad}
                className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-accent/90 active:scale-95"
              >
                Try again
              </button>
            ) : hasFilters ? (
              <button
                type="button"
                onClick={clearAll}
                className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50 active:scale-95"
              >
                <X size={12} />
                Clear all filters
              </button>
            ) : (
              isAdmin && (
                <Link
                  href="/admin"
                  className="tap-lg mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-white shadow-2xs transition hover:bg-accent/90 active:scale-95"
                >
                  <Upload size={15} />
                  Upload a Song
                </Link>
              )
            )}
          </div>
        )}
      </div>

      </div>

      <ScrollToTop scrollY={scrollY} />
    </main>
  );
}
