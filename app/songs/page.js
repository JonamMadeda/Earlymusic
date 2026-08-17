"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { usePlayer } from "../context/PlayerContext";
import { useAuth } from "../context/AuthContext";
import { PageSkeleton } from "../components/Skeleton";
import SongAvatar from "../components/SongAvatar";

import {
  ChevronDown,
  ChevronUp,
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
    className={`whitespace-nowrap rounded-full border px-3 py-2 md:px-4 md:py-2.5 text-[11px] md:text-xs font-medium transition ${
      active
        ? "border-neutral-200/80 bg-neutral-900 text-white hover:bg-neutral-800"
        : "border-neutral-200/80 bg-white text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
    }`}
  >
    {label}
  </button>
);

const categoryColors = {
  Worship: "bg-blue-50 text-blue-600",
  Praise: "bg-purple-50 text-purple-600",
};

const SongRow = ({ song, onClick, isActive }) => {
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
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(e); } }}
      className={`group relative flex w-full items-center gap-2.5 md:gap-3.5 rounded-2xl p-2.5 md:p-3.5 text-left transition-all duration-300 shadow-sm ${
        isActive
          ? "bg-neutral-100/80 shadow-inner"
          : "bg-white border border-neutral-100 hover:shadow-md hover:border-neutral-200"
      }`}
    >
      <div className="relative shrink-0">
        <SongAvatar title={song.title} />
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/0 transition-all group-hover:bg-black/30">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-neutral-900 opacity-0 transition-all group-hover:opacity-100 shadow-sm translate-y-1 group-hover:translate-y-0">
            <Play size={11} fill="currentColor" className="ml-0.5" />
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold tracking-tight text-neutral-900">
            {song.title}
          </p>
          {isActive && (
            <div className="waveform shrink-0 text-accent">
              <span /><span /><span /><span />
            </div>
          )}
          {isNew && !isActive && (
            <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-accent">
              New
            </span>
          )}
          {song.category && (
            <span className={`hidden md:inline-block rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${categoryColors[song.category] || "bg-neutral-100 text-neutral-500"}`}>
              {song.category}
            </span>
          )}
        </div>
        <p className="truncate text-[11px] font-medium text-neutral-400 mt-0.5">
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
          className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 hover:bg-accent hover:text-white"
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
              onClick={toggleDownload}
              className="flex w-full items-center gap-x-3 rounded-2xl px-3 py-3 text-left text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
            >
              {downloadStatus === "downloading" ? (
                <SpinnerIcon size={16} className="animate-spin text-neutral-400" />
              ) : downloadStatus === "downloaded" ? (
                <Check size={16} className="text-green-500" strokeWidth={3} />
              ) : (
                <Download size={16} className="text-neutral-400" />
              )}
              <span className={`text-[13px] font-semibold ${downloadStatus === "error" ? "text-red-500" : ""}`}>
                {downloadStatus === "downloading" ? "Downloading..." : downloadStatus === "downloaded" ? "Remove Download" : downloadStatus === "error" ? downloadError : "Download for offline"}
              </span>
            </button>
            <button
              onClick={toggleSave}
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
    </div>
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

useEffect(() => {
    const fetchedRef = { current: false };
    const fetchSongs = async () => {
      if (fetchedRef.current) return;
      fetchedRef.current = true;

      let hasCachedSongs = false;

      try {
        setIsLoading(true);

        const cachedSongs = localStorage.getItem("earlymusic_songs_cache");
        if (cachedSongs) {
          try {
            const parsedSongs = JSON.parse(cachedSongs);
            hasCachedSongs = Array.isArray(parsedSongs) && parsedSongs.length > 0;
            if (hasCachedSongs) {
              setAllSongs(parsedSongs);
              setIsLoading(false);
            }
          } catch {
            localStorage.removeItem("earlymusic_songs_cache");
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
            localStorage.setItem("earlymusic_songs_cache", JSON.stringify(data));
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
    searchValue.trim(),
    activeFilter,
    activeCategory,
    activeDuration,
  ].filter((value) => value && value !== "All").length;

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

  return (
    <main className="min-h-[90vh] bg-transparent pb-16 pt-2 md:pt-6">
      <div className="mx-auto max-w-5xl px-3 md:px-8">
        <section className="mb-6 md:mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 md:text-2xl">
              Songs
            </h1>
            <span className="hidden md:inline-flex items-center gap-2 rounded-full border border-neutral-100 bg-neutral-50/60 px-3 py-1 text-[11px] font-medium text-neutral-400">
              {filteredSongs.length} / {allSongs?.length || 0}
            </span>
          </div>
          <div className="mt-3 md:hidden inline-flex items-center gap-2 rounded-full border border-neutral-100 bg-neutral-50/60 px-3 py-1 text-[11px] font-medium text-neutral-400">
            {filteredSongs.length} tracks
          </div>
        </section>
      </div>

      {/* Sticky Search / Filter Bar */}
      <div className="sticky top-0 z-40 border-b border-neutral-100 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-3 md:px-8 py-3">
          <div className="flex flex-row flex-nowrap gap-2 md:min-w-[460px] md:justify-start">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-neutral-200/80 bg-neutral-50/60 px-3 py-2 text-neutral-500 transition focus-within:border-neutral-300 focus-within:bg-white md:px-3.5 md:py-2.5">
              <Search size={14} className="shrink-0" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search"
                className="min-w-0 flex-1 bg-transparent text-xs font-medium text-neutral-900 outline-none placeholder:text-neutral-300"
              />
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
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-neutral-200/80 bg-white px-3.5 py-2 text-xs font-medium text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900 md:gap-2 md:px-4 md:py-2.5"
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
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-neutral-200/80 bg-white px-3.5 py-2 text-xs font-medium text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900 md:gap-2 md:px-4 md:py-2.5"
            >
              <Filter size={14} />
              <span>Filters</span>
              {filtersOpen ? <ChevronUp size={14} className="shrink-0" /> : <ChevronDown size={14} className="shrink-0" />}
            </button>
          </div>

          {hasFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-[11px] font-semibold text-neutral-500">
                {activeFilterCount} active
              </span>
              {searchValue.trim() && (
                <button
                  type="button"
                  onClick={() => setSearchValue("")}
                  className="rounded-full border border-neutral-200/80 bg-white px-3 py-1.5 text-[11px] font-medium text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900"
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
                className="rounded-full border border-neutral-200/80 bg-white px-3 py-1.5 text-[11px] font-medium text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      </div>

      {filtersOpen && (
        <div className="mx-auto max-w-5xl px-3 md:px-8">
          <section className="mb-5 mt-4 md:mb-6 rounded-2xl bg-neutral-50/60 px-3 md:px-4 py-3 md:py-4">
            <div className="flex flex-col gap-2.5 md:grid md:grid-cols-3 md:gap-3">
              <div>
                <p className="mb-1.5 md:mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-neutral-400">
                  Time
                </p>
                <div className="flex flex-wrap gap-1.5 md:gap-2">
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
                <p className="mb-1.5 md:mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-neutral-400">
                  Type
                </p>
                <div className="flex flex-wrap gap-1.5 md:gap-2">
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
                <p className="mb-1.5 md:mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-neutral-400">
                  Duration
                </p>
                <div className="flex flex-wrap gap-1.5 md:gap-2">
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
        </div>
      )}

      {/* Song List + Alphabet Jump */}
      <div className="mx-auto max-w-5xl px-3 md:px-8 relative">
        {isLoading ? (
          <PageSkeleton />
        ) : alphabet.length > 0 ? (
          <div className="flex gap-3">
            {/* Songs */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col gap-y-2 md:gap-y-4">
                {alphabet.map((letter) => (
                  <div
                    key={letter}
                    ref={(el) => { letterRefs.current[letter] = el; }}
                    className="scroll-mt-28 flex flex-col gap-y-1 md:gap-y-2"
                  >
                    <div className="flex items-center gap-3 border-b border-neutral-100 pb-1.5 md:pb-2 px-1 md:px-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-100 text-sm font-bold text-neutral-500 md:h-8 md:w-8 md:text-base">
                        {letter}
                      </div>
                      <span className="text-[11px] text-neutral-400">
                        {groupedSongs[letter].length} {groupedSongs[letter].length === 1 ? "song" : "songs"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-y-1 md:gap-y-2">
                      {groupedSongs[letter].map((song) => (
                        <SongRow
                          key={song.id}
                          song={song}
                          isActive={activeSong?.id === song.id}
                          onClick={() => setActiveSong(song, filteredSongs)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alphabet Jump Bar */}
            <div className="hidden lg:flex flex-col items-center gap-0.5 sticky top-28 self-start pt-2">
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
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Disc className="mb-4 text-neutral-300" size={32} />
            <p className="text-sm font-semibold text-neutral-900">
              {loadError
                ? "Songs could not be loaded"
                : hasFilters
                  ? "No matching songs"
                  : "No songs yet"}
            </p>
            <p className="mt-1 max-w-sm text-xs text-neutral-450">
              {loadError
                ? "Check your connection or Supabase configuration and try again."
                : hasFilters
                  ? "Try adjusting your search or clearing the filters."
                  : "Once tracks are uploaded, they&apos;ll appear here."}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
