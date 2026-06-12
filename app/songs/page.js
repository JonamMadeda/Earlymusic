"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { usePlayer } from "../context/PlayerContext";
import { useAuth } from "../context/AuthContext";
import Loader from "../components/Loader";
import DownloadButton from "../components/DownloadButton";
import {
  ChevronDown,
  ChevronUp,
  Disc,
  Filter,
  Music,
  MoreHorizontal,
  Search,
  Info,
  Heart,
  ListPlus,
  ListMusic,
  Plus,
} from "lucide-react";

const timeFilters = [
  { label: "All", days: null },
  { label: "New", days: 14 },
  { label: "1 Month", days: 30 },
  { label: "3 Months", days: 90 },
  { label: "1 Year", days: 365 },
];

const categories = ["All", "Worship", "Praise"];
const durations = ["All", "Long", "Short"];

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

const SongRow = ({ song, onClick, isActive }) => {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const rowRef = useRef(null);
  const isNew =
    song.created_at &&
    Date.now() - new Date(song.created_at).getTime() < 14 * 24 * 60 * 60 * 1000;
  const [isSaved, setIsSaved] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [newPlaylistName, setNewPlaylistName] = useState("");

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
      .then(({ data }) => setIsSaved(!!data));
  }, [user, song.id]);

  useEffect(() => {
    if (showPlaylists && user) {
      supabase
        .from("playlists")
        .select("id, name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .then(({ data }) => setPlaylists(data || []));
    }
  }, [showPlaylists, user]);

  const addToPlaylist = async (e, playlistId) => {
    e.stopPropagation();
    await supabase
      .from("playlist_songs")
      .insert({ playlist_id: playlistId, song_id: song.id });
  };

  const createAndAdd = async (e) => {
    e.stopPropagation();
    const name = newPlaylistName.trim();
    if (!name || !user) return;

    const { data: pl } = await supabase
      .from("playlists")
      .insert({ name, user_id: user.id })
      .select()
      .single();

    if (pl) {
      await supabase
        .from("playlist_songs")
        .insert({ playlist_id: pl.id, song_id: song.id });
      setNewPlaylistName("");
      setShowPlaylists(false);
    }
  };

  const toggleSave = async (e) => {
    e.stopPropagation();
    if (!user) {
      router.push(`/auth?redirectTo=${encodeURIComponent(pathname)}`);
      return;
    }

    if (isSaved) {
      await supabase
        .from("saved_songs")
        .delete()
        .eq("user_id", user.id)
        .eq("song_id", song.id);
      setIsSaved(false);
    } else {
      await supabase
        .from("saved_songs")
        .insert({ user_id: user.id, song_id: song.id });
      setIsSaved(true);
    }
    setShowMenu(false);
  };

  return (
    <div
      ref={rowRef}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(e); }}
      className={`group relative flex w-full items-center gap-2.5 md:gap-3.5 rounded-2xl p-2.5 md:p-3.5 text-left transition-all duration-300 ${
        isActive
          ? "bg-neutral-100/80"
          : "bg-neutral-50/60 hover:bg-neutral-100/80"
      }`}
    >
      <div
        className={`flex h-10 w-10 md:h-12 md:w-12 flex-shrink-0 items-center justify-center rounded-xl transition-colors ${
          isActive
            ? "bg-neutral-900 text-white"
            : "bg-neutral-900/5 text-neutral-800 group-hover:bg-accent group-hover:text-white"
        }`}
      >
        <Music size={18} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold tracking-tight text-neutral-900">
            {song.title}
          </p>
          {isNew && (
            <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-accent">
              New
            </span>
          )}
        </div>
        <p className="truncate text-[11px] font-medium text-neutral-400 mt-0.5">
          {song.author}
        </p>
      </div>

      <div className="relative flex items-center gap-1.5">
        <DownloadButton song={song} />
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
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

  useEffect(() => {
    const fetchSongs = async () => {
      try {
        if (allSongs.length > 0) {
          setIsLoading(false);
          return;
        }

        setIsLoading(true);

        const cachedSongs = localStorage.getItem("earlymusic_songs_cache");
        if (cachedSongs) {
          setAllSongs(JSON.parse(cachedSongs));
          setIsLoading(false);
        }

        const { data, error } = await supabase
          .from("songs")
          .select("*")
          .order("title", { ascending: true });

        if (data) {
          setAllSongs(data);
          localStorage.setItem("earlymusic_songs_cache", JSON.stringify(data));
        } else if (error && !cachedSongs) {
          console.error("Fetch error and no cache:", error);
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSongs();
  }, [allSongs, setAllSongs, setIsLoading]);

  const groupedSongs = useMemo(() => {
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

    return songs
      .sort((a, b) => a.title.localeCompare(b.title))
      .reduce((groups, song) => {
        const letter = song.title[0]?.toUpperCase() || "#";
        if (!groups[letter]) groups[letter] = [];
        groups[letter].push(song);
        return groups;
      }, {});
  }, [allSongs, searchValue, activeFilter, activeCategory, activeDuration]);

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

  return (
    <main className="min-h-[90vh] bg-transparent px-3 pb-36 pt-2 md:px-8 md:pt-6">
      <div className="mx-auto max-w-5xl">
        <section className="mb-6 md:mb-8">
          <div className="flex items-center gap-3">
            <div className="h-6 w-1 rounded-full bg-accent" />
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 md:text-2xl uppercase">
              Songs
            </h1>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-400 max-w-xl">
            Browse the full collection of curated songs.
          </p>
          <div className="mt-3 md:mt-4 flex items-center gap-3.5 text-xs text-neutral-400">
            <span>{allSongs?.length || 0} tracks</span>
          </div>

          <div className="mt-4 md:mt-6 flex flex-row flex-nowrap gap-2 md:min-w-[460px] md:justify-start">
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
            <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-neutral-100 pb-4">
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
        </section>

        {filtersOpen && (
          <section className="mb-5 md:mb-6 rounded-2xl bg-neutral-50/60 px-3 md:px-4 py-3 md:py-4">
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
        )}

        {isLoading ? (
          <Loader />
        ) : alphabet.length > 0 ? (
          <div className="flex flex-col gap-y-4 md:gap-y-6">
            {alphabet.map((letter) => (
              <div key={letter} className="flex flex-col gap-y-2 md:gap-y-3">
                <div className="flex items-center gap-x-3 border-b border-neutral-100 pb-1.5 md:pb-2 px-1 md:px-2">
                  <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-neutral-900">
                    {letter}
                  </h2>
                </div>
                  <div className="flex flex-col gap-y-1 md:gap-y-2">
                    {groupedSongs[letter].map((song) => (
                    <SongRow
                      key={song.id}
                      song={song}
                      isActive={activeSong?.id === song.id}
                      onClick={() => setActiveSong(song, allSongs)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Disc className="mb-4 text-neutral-300" size={32} />
            <p className="text-sm font-semibold text-neutral-900">No songs yet</p>
            <p className="mt-1 max-w-sm text-xs text-neutral-450">
              Once tracks are uploaded, they&apos;ll appear here.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
