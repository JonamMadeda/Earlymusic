"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { usePlayer } from "../context/PlayerContext";
import { useAuth } from "../context/AuthContext";
import { PageSkeleton } from "../components/Skeleton";
import SongAvatar from "../components/SongAvatar";
import { prefetchSongAudio } from "@/lib/prefetchAudio";

import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Disc,
  Download,
  Filter,
  MoreHorizontal,
  Search,
  Info,
  Heart,
  ListPlus,
  ListMusic,
  Plus,
  Check,
  Play,
  ArrowUpDown,
  X,
  ArrowUp,
  Loader as SpinnerIcon,
} from "lucide-react";


const timeWindowDays = 30;

const timeFilters = [
  { label: "All", days: null },
  { label: "New", days: 14 },
  { label: "1 Month", days: 30 },
  { label: "3 Months", days: 90 },
  { label: "1 Year", days: 365 },
];

const categories = ["All", "Worship", "Praise"];
const durations = ["All", "Long", "Short"];

const sortOptions = [
  { label: "Title", value: "title" },
  { label: "Artist", value: "author" },
  { label: "Date Added", value: "created_at" },
];

const Chip = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`whitespace-nowrap rounded-lg border px-3 py-1.5 md:px-3.5 md:py-2 text-[11px] md:text-xs font-semibold transition-all duration-150 ${
      active
        ? "border-accent bg-accent text-white shadow-2xs"
        : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 hover:border-neutral-300"
    }`}
  >
    {label}
  </button>
);

const SongRow = ({ song, onClick, isActive, onCategoryClick, menuUp = false }) => {
  const menuPos = menuUp ? "bottom-0 mb-10" : "top-0 mt-10";
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const rowRef = useRef(null);
  const isNew =
    song.created_at &&
    Date.now() - new Date(song.created_at).getTime() <
      timeWindowDays * 24 * 60 * 60 * 1000;
  const [isSaved, setIsSaved] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [downloadStatus, setDownloadStatus] = useState("idle");
  const [downloadError, setDownloadError] = useState("");
  const dlTimeoutRef = useRef(null);

  useEffect(() => {
    import("@/lib/downloadManager").then(({ isSongDownloaded }) => {
      if (isSongDownloaded(song.id)) setDownloadStatus("downloaded");
    }).catch((error) => console.error("Unable to check download status:", error));
  }, [song.id]);

  useEffect(() => {
    return () => clearTimeout(dlTimeoutRef.current);
  }, []);

  const toggleDownload = async (e) => {
    e.stopPropagation();
    if (downloadStatus === "downloaded") {
      const { removeDownload } = await import("@/lib/downloadManager");
      await removeDownload(song.id);
      setDownloadStatus("idle");
      setShowMenu(false);
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
    if (!user) {
      setIsSaved(false);
      return;
    }

    supabase
      .from("saved_songs")
      .select("id")
      .eq("user_id", user.id)
      .eq("song_id", song.id)
      .maybeSingle()
      .then(({ data }) => setIsSaved(!!data))
      .catch((error) => console.error("Unable to check saved song:", error));
  }, [user, song.id]);

  useEffect(() => {
    if (showPlaylists && user) {
      supabase
        .from("playlists")
        .select("id, name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .then(({ data }) => setPlaylists(data || []))
        .catch((error) => console.error("Unable to load playlists:", error));
    }
  }, [showPlaylists, user]);

  const addToPlaylist = async (e, playlistId) => {
    e.stopPropagation();
    try {
      const { data: existing, error: checkError } = await supabase
        .from("playlist_songs")
        .select("id")
        .eq("playlist_id", playlistId)
        .eq("song_id", song.id)
        .maybeSingle();
      if (checkError) throw checkError;
      if (existing) return;
      const { error } = await supabase
        .from("playlist_songs")
        .insert({ playlist_id: playlistId, song_id: song.id });
      if (error) throw error;
    } catch (error) {
      console.error("Unable to add song to playlist:", error);
    }
  };

  const createAndAdd = async (e) => {
    e.stopPropagation();
    const name = newPlaylistName.trim();
    if (!name || !user) return;

    try {
      const { data: pl, error: createError } = await supabase
        .from("playlists")
        .insert({ name, user_id: user.id })
        .select()
        .single();
      if (createError) throw createError;

      if (pl) {
        const { error } = await supabase
          .from("playlist_songs")
          .insert({ playlist_id: pl.id, song_id: song.id });
        if (error) throw error;
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
        const { error } = await supabase
          .from("saved_songs")
          .delete()
          .eq("user_id", user.id)
          .eq("song_id", song.id);
        if (error) throw error;
        setIsSaved(false);
      } else {
        const { error } = await supabase
          .from("saved_songs")
          .insert({ user_id: user.id, song_id: song.id });
        if (error) throw error;
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
      role="button"
      tabIndex={0}
      onClick={onClick}
      onMouseEnter={() => prefetchSongAudio(song)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(e); } }}
      className={`group relative flex w-full items-center gap-2.5 md:gap-3 rounded-xl p-2.5 md:p-3 text-left transition-all duration-200 hover:-translate-y-0.5 ${
        isActive
          ? "border-2 border-accent bg-neutral-50 shadow-xs"
          : "border border-neutral-200 bg-white hover:border-neutral-400/80 shadow-2xs"
      }`}
    >
      <div className="relative shrink-0">
        <SongAvatar title={song.title} variant="mono" size="md" />
        {downloadStatus === "downloaded" && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-white" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className={`truncate text-xs sm:text-sm font-semibold tracking-tight ${isActive ? "text-accent" : "text-neutral-900"}`}>
            {song.title}
          </p>
          {isActive && (
            <div className="waveform shrink-0 text-accent">
              <span /><span /><span /><span />
            </div>
          )}
          {isNew && !isActive && (
            <span className="rounded bg-accent px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider text-white">
              New
            </span>
          )}
          {song.category && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCategoryClick?.(song.category);
              }}
              className="hidden md:inline-block rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[9px] font-semibold text-neutral-600 transition hover:border-neutral-300"
            >
              {song.category}
            </button>
          )}
        </div>
        <p className="truncate text-[11px] font-medium text-neutral-500 mt-0.5">
          {song.author}
        </p>
      </div>

      <div className="relative flex items-center gap-1.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
            setShowInfo(false);
            setShowPlaylists(false);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 hover:bg-accent hover:text-white"
          title="More"
        >
          <MoreHorizontal size={14} />
        </button>

        {showMenu && (
          <div
            onClick={(e) => e.stopPropagation()}
            className={`absolute right-0 z-50 min-w-[210px] rounded-xl border border-neutral-100 bg-white p-2 shadow-lg ${menuPos}`}
          >
            <button
              onClick={() => {
                setShowInfo(true);
                setShowMenu(false);
                setShowPlaylists(false);
              }}
              className="flex w-full items-center gap-x-3 rounded-lg px-3 py-2.5 text-left text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
            >
              <Info size={15} className="text-neutral-400" />
              <span className="text-xs font-semibold">Compilation Details</span>
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
              className="flex w-full items-center gap-x-3 rounded-lg px-3 py-2.5 text-left text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
            >
              <ListPlus size={15} className="text-neutral-400" />
              <span className="text-xs font-semibold">Add to Playlist</span>
            </button>
            <button
              onClick={toggleDownload}
              className="flex w-full items-center gap-x-3 rounded-lg px-3 py-2.5 text-left text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
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
            <button
              onClick={toggleSave}
              className="flex w-full items-center gap-x-3 rounded-lg px-3 py-2.5 text-left text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
            >
              <Heart
                size={15}
                className={isSaved ? "text-neutral-900 fill-neutral-900" : "text-neutral-400"}
              />
              <span className="text-xs font-semibold">
                {isSaved ? "Remove from Library" : "Add to Library"}
              </span>
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
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Compilation Details
              </h4>
              <button
                onClick={() => setShowInfo(false)}
                className="text-neutral-300 transition hover:text-neutral-900"
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
          </div>
        </div>
      )}

      {showPlaylists && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute right-0 z-50 min-w-[240px] rounded-xl border border-neutral-100 bg-white p-4 shadow-lg ${menuPos}`}
        >
          <div className="mb-3 flex items-center justify-between border-b border-neutral-50 pb-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Add to Playlist
            </h4>
            <button
              onClick={() => setShowPlaylists(false)}
              className="text-neutral-300 transition hover:text-neutral-900"
            >
              <X size={14} />
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
                  className="flex w-full items-center gap-x-3 rounded-lg px-3 py-2.5 text-left text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
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
                className="flex-shrink-0 rounded-lg bg-accent p-2 text-white transition hover:bg-accent/90 disabled:opacity-50"
                title="Create & Add"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ScrollProgress = ({ progress }) => {
  if (progress < 0.01) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[600] h-[2px] bg-transparent">
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
      onClick={scrollToTop}
      className={`fixed z-50 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white shadow-lg transition hover:bg-accent/90 left-4 lg:left-auto lg:right-8 ${
        activeSong ? "bottom-40 md:bottom-24" : "bottom-24 md:bottom-8"
      }`}
    >
      <ArrowUp size={18} />
    </button>
  );
};

export default function SongsPage() {
  const {
    allSongs,
    setAllSongs,
    setActiveSong,
    activeSong,
    isLoading,
    setIsLoading,
  } = usePlayer();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeDuration, setActiveDuration] = useState("All");
  const [sortBy, setSortBy] = useState("title");
  const [sortAsc, setSortAsc] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [jumpLetter, setJumpLetter] = useState(null);
  const jumpTimeoutRef = useRef(null);
  const letterRefs = useRef({});
  const searchInputRef = useRef(null);
  const headerRef = useRef(null);
  const [pastHeader, setPastHeader] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Show the floating A-Z bar only after the title header scrolls out of view,
  // so it never overlaps the title + search bar stack at rest.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setPastHeader(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

useEffect(() => {
    const fetchedRef = { current: false };
    const fetchSongs = async () => {
      if (fetchedRef.current) return;
      fetchedRef.current = true;

      let hasCachedSongs = false;

      try {
        setIsLoading(true);

        const cachedSongs = localStorage.getItem("lumbo_songs_cache");
        if (cachedSongs) {
          try {
            const parsedSongs = JSON.parse(cachedSongs);
            hasCachedSongs = Array.isArray(parsedSongs) && parsedSongs.length > 0;
            if (hasCachedSongs) {
              setAllSongs(parsedSongs);
              setIsLoading(false);
            }
          } catch {
            localStorage.removeItem("lumbo_songs_cache");
          }
        }

        const { data, error } = await supabase
          .from("songs")
          .select("*")
          .order("title", { ascending: true });

        if (error) {
          throw error;
        }

        if (data) {
          setAllSongs(data);
          if (data.length > 0) {
            localStorage.setItem("lumbo_songs_cache", JSON.stringify(data));
          }
        }
      } catch (error) {
        console.error("Error:", error);
        if (!hasCachedSongs) setLoadError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSongs();
  }, [setAllSongs, setIsLoading]);

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
      if (filterObj?.days) {
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
  }, [allSongs, searchValue, activeFilter, activeCategory, activeDuration, sortBy, sortAsc]);

  const groupedSongs = useMemo(() => {
    return filteredSongs.reduce((groups, song) => {
        const letter = song.title?.[0]?.toUpperCase() || "#";
        if (!groups[letter]) groups[letter] = [];
        groups[letter].push(song);
        return groups;
      }, {});
  }, [filteredSongs]);

  const alphabet = Object.keys(groupedSongs).sort();
  const hasFilters =
    searchValue.trim() ||
    activeFilter !== "All" ||
    activeCategory !== "All" ||
    activeDuration !== "All";
  const activeFilterCount = [
    searchValue.trim() ? "search" : null,
    activeFilter !== "All" ? activeFilter : null,
    activeCategory !== "All" ? activeCategory : null,
    activeDuration !== "All" ? activeDuration : null,
  ].filter(Boolean).length;

  const stats = useMemo(() => {
    const list = allSongs || [];
    const cutoff = Date.now() - timeWindowDays * 24 * 60 * 60 * 1000;
    return {
      total: list.length,
      artists: new Set(list.map((s) => s.author).filter(Boolean)).size,
      new: list.filter(
        (s) => s.created_at && new Date(s.created_at).getTime() >= cutoff
      ).length,
    };
  }, [allSongs]);

  const scrollToLetter = useCallback((letter) => {
    setJumpLetter(letter);
    clearTimeout(jumpTimeoutRef.current);
    jumpTimeoutRef.current = setTimeout(() => setJumpLetter(null), 800);

    const el = letterRefs.current[letter];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  useEffect(() => {
    return () => clearTimeout(jumpTimeoutRef.current);
  }, []);

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
    if (filteredSongs.length > 0) {
      setActiveSong(filteredSongs[0], filteredSongs);
    }
  }, [filteredSongs, setActiveSong]);

  return (
    <main className="min-h-[90vh] bg-white px-3 sm:px-6 md:px-8 pb-32 md:pb-28 pt-3 md:pt-5">
      <ScrollProgress progress={scrollProgress} />
      <div className="mx-auto max-w-5xl space-y-4 md:space-y-5">
        <section ref={headerRef} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900">
              Songs
            </h1>
            <p className="mt-0.5 text-[11px] font-medium text-neutral-500">
              <span className="font-bold text-neutral-800">{stats.total}</span> tracks
              <span className="text-neutral-300"> • </span>
              <span className="font-bold text-neutral-800">{stats.artists}</span> artists
              {stats.new > 0 && (
                <>
                  <span className="text-neutral-300"> • </span>
                  <span className="font-bold text-accent">{stats.new} new</span>
                </>
              )}
            </p>
          </div>
          {filteredSongs.length > 0 && (
            <button
              type="button"
              onClick={playAll}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-accent/90"
            >
              <Play size={11} fill="currentColor" />
              <span>Play All ({filteredSongs.length})</span>
            </button>
          )}
        </section>

      {/* Sticky Search / Filter Bar */}
      <div className="sticky top-2 z-40 rounded-xl border border-neutral-200 bg-white/95 shadow-2xs backdrop-blur-md">
        <div className="px-3 py-2.5">
          <div className="flex flex-row flex-nowrap items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-transparent bg-neutral-100/80 px-3 py-2 text-neutral-500 transition focus-within:border-accent focus-within:bg-white focus-within:shadow-2xs">
              <Search size={15} className="shrink-0 text-neutral-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search songs or artists..."
                className="min-w-0 flex-1 bg-transparent text-xs font-medium text-neutral-900 outline-none placeholder:text-neutral-400"
              />
              {searchValue && (
                <button
                  type="button"
                  onClick={() => setSearchValue("")}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-500 transition hover:bg-neutral-300"
                >
                  <X size={10} strokeWidth={3} />
                </button>
              )}
            </div>

            {/* Sort Button */}
            <button
              type="button"
              onClick={() => {
                if (sortBy === "title") {
                  setSortBy("author");
                } else if (sortBy === "author") {
                  setSortBy("created_at");
                  setSortAsc(false);
                } else {
                  setSortBy("title");
                  setSortAsc(true);
                }
              }}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-neutral-200/80 bg-white px-3 py-2 text-xs font-medium text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900 md:gap-2 md:px-3.5"
              title={`Sort by: ${sortOptions.find(o => o.value === sortBy)?.label}`}
            >
              <ArrowUpDown size={14} />
              <span className="hidden md:inline">{sortOptions.find(o => o.value === sortBy)?.label}</span>
              <span
                className="cursor-pointer text-neutral-400 hover:text-neutral-700"
                onClick={(e) => {
                  e.stopPropagation();
                  setSortAsc(!sortAsc);
                }}
              >
                {sortAsc ? "A-Z" : "Z-A"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFiltersOpen((prev) => !prev)}
              className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition md:gap-2 md:px-3.5 ${
                activeFilterCount > 0
                  ? "border-accent bg-accent/8 text-accent hover:bg-accent/15"
                  : "border-neutral-200/80 bg-white text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
              }`}
            >
              <Filter size={14} />
              <span className="hidden sm:inline">Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}</span>
              {filtersOpen ? <ChevronUp size={14} className="shrink-0" /> : <ChevronDown size={14} className="shrink-0" />}
            </button>
          </div>

          {hasFilters && (
            <div className="flex flex-wrap items-center gap-2 px-1 pt-2.5">
              <span className="text-[11px] font-medium text-neutral-500">
                <span className="font-bold text-neutral-800">{filteredSongs.length}</span> of {allSongs?.length || 0} songs
              </span>
              <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-500">
                {activeFilterCount} active
              </span>
              {searchValue.trim() && (
                <button
                  type="button"
                  onClick={() => setSearchValue("")}
                  className="rounded-md border border-neutral-200/80 bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900"
                >
                  Clear search
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setActiveFilter("All");
                  setActiveCategory("All");
                  setActiveDuration("All");
                }}
                className="rounded-md border border-neutral-200/80 bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      </div>

      {filtersOpen && (
          <section className="rounded-xl border border-neutral-200 bg-white px-4 py-4 shadow-2xs md:px-5 md:py-5">
            <div className="flex flex-col gap-4 md:grid md:grid-cols-3 md:gap-6">
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-neutral-400">
                  Time
                </p>
                <div className="flex flex-wrap gap-2">
                  {timeFilters.map((filter) => (
                    <Chip
                      key={filter.label}
                      label={filter.label}
                      active={activeFilter === filter.label}
                      onClick={() => setActiveFilter(filter.label)}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-neutral-400">
                  Type
                </p>
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <Chip
                      key={category}
                      label={category}
                      active={activeCategory === category}
                      onClick={() => setActiveCategory(category)}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-neutral-400">
                  Duration
                </p>
                <div className="flex flex-wrap gap-2">
                  {durations.map((duration) => (
                    <Chip
                      key={duration}
                      label={duration}
                      active={activeDuration === duration}
                      onClick={() => setActiveDuration(duration)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>
      )}

      {/* Song List + Alphabet Jump */}
      <div className="relative">
        {isLoading ? (
          <PageSkeleton />
        ) : alphabet.length > 0 ? (
          <div className="flex gap-4">
            {/* Songs */}
            <div className="flex-1 min-w-0 pr-6 lg:pr-0">
              <div className="flex flex-col gap-y-5 md:gap-y-6">
                {alphabet.map((letter, letterIdx) => (
                  <div
                    key={letter}
                    ref={(el) => { letterRefs.current[letter] = el; }}
                    className="scroll-mt-36 flex flex-col gap-y-2.5"
                  >
                    <div className={`sticky ${hasFilters ? "top-[120px]" : "top-[80px]"} z-10 flex justify-start pb-1`}>
                      <div className="flex items-center gap-2 rounded-full border border-neutral-200/70 bg-white/75 py-1 pl-1 pr-3 shadow-2xs backdrop-blur-md">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/[0.07] text-xs font-bold text-accent">
                          {letter}
                        </div>
                        <span className="text-[11px] font-medium text-neutral-500">
                          {groupedSongs[letter].length} {groupedSongs[letter].length === 1 ? "song" : "songs"}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-y-1.5 md:gap-y-2">
                      {groupedSongs[letter].map((song, idx) => {
                        const menuUp =
                          letterIdx === alphabet.length - 1 &&
                          idx >= groupedSongs[letter].length - 2;
                        return (
                          <SongRow
                            key={song.id}
                            song={song}
                            isActive={activeSong?.id === song.id}
                            onClick={() => setActiveSong(song, filteredSongs)}
                            onCategoryClick={handleCategoryClick}
                            menuUp={menuUp}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alphabet Jump Bar - desktop */}
            <div className="hidden lg:flex flex-col items-center gap-1 sticky top-32 self-start pt-4">
              {alphabet.map((letter) => (
                <button
                  key={letter}
                  onClick={() => scrollToLetter(letter)}
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-all duration-200 ${
                    jumpLetter === letter
                      ? "bg-accent text-white scale-125"
                      : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                  }`}
                >
                  {letter}
                </button>
              ))}
            </div>

            {/* Alphabet Jump Bar - mobile floating (fixed, so placement inside flex is fine) */}
            <div className={`lg:hidden fixed right-1.5 top-40 bottom-28 z-30 flex flex-col items-center gap-px overflow-y-auto rounded-full border border-neutral-200 bg-white/90 px-0.5 shadow-2xs backdrop-blur-md no-scrollbar transition-opacity duration-300 ${pastHeader ? "opacity-100" : "pointer-events-none opacity-0"}`}>
              {alphabet.map((letter) => (
                <button
                  key={letter}
                  type="button"
                  aria-label={`Jump to ${letter}`}
                  onClick={() => scrollToLetter(letter)}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all duration-200 select-none first:mt-2 last:mb-2 ${
                    jumpLetter === letter
                      ? "bg-accent text-white scale-110"
                      : "text-neutral-400 active:bg-neutral-100 active:text-neutral-700"
                  }`}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-100 border border-neutral-200">
              {loadError ? (
                <Download className="text-accent" size={24} />
              ) : hasFilters ? (
                <Search className="text-accent" size={24} />
              ) : (
                <Disc className="text-accent" size={24} />
              )}
            </div>
            <p className="text-base font-bold tracking-tight text-neutral-900">
              {loadError
                ? "Songs could not be loaded"
                : hasFilters
                  ? "No matching songs"
                  : "No songs yet"}
            </p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-neutral-500">
              {loadError
                ? "Check your connection or Supabase configuration and try again."
                : hasFilters
                  ? "Try adjusting your search or clearing the filters."
                  : "Upload your first worship song and it will appear here automatically."}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchValue("");
                  setActiveFilter("All");
                  setActiveCategory("All");
                  setActiveDuration("All");
                }}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50"
              >
                <X size={12} />
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      </div>

      <ScrollToTop scrollY={scrollY} />
    </main>
  );
}
