"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { usePlayer } from "./context/PlayerContext";
import { useAuth } from "./context/AuthContext";
import { PageSkeleton } from "./components/Skeleton";
import SongAvatar, { initialLetter, hashStr } from "./components/SongAvatar";
import {
  Music,
  ArrowRight,
  Play,
  Upload,
  Sparkles,
  Star,
  Clock,
  ListMusic,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Shuffle,
  Sun,
  Sunrise,
  Moon,
  Quote,
  Compass,
} from "lucide-react";
import LazySection from "./components/LazySection";
import { prefetchSongAudio } from "@/lib/prefetchAudio";

const timeWindowDays = 30;

const verses = [
  { ref: "Psalm 150:6", text: "Let everything that has breath praise the Lord." },
  { ref: "Psalm 95:1", text: "Oh come, let us sing to the Lord; let us make a joyful noise to the rock of our salvation!" },
  { ref: "Psalm 100:1-2", text: "Make a joyful noise to the Lord, all the earth! Serve the Lord with gladness!" },
  { ref: "Colossians 3:16", text: "Let the word of Christ dwell in you richly, singing psalms and hymns and spiritual songs." },
  { ref: "Psalm 96:1", text: "Oh sing to the Lord a new song; sing to the Lord, all the earth!" },
  { ref: "Ephesians 5:19", text: "Addressing one another in psalms and hymns and spiritual songs, singing and making melody to the Lord." },
];

const mulberry32 = (seed) => {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const seededShuffle = (arr, seedStr) => {
  const rng = mulberry32(hashStr(seedStr || "s"));
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const ScrollProgress = () => {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
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

/* --- COMPACT, RETRO-LINED MONOCHROMATIC CARD COMPONENTS --- */

// Horizontal pill card (Used in Jump Back In / Rails)
const SongRailCard = ({ song, onClick, isActive }) => {
  const isNew =
    song.created_at &&
    Date.now() - new Date(song.created_at).getTime() <
      timeWindowDays * 24 * 60 * 60 * 1000;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => prefetchSongAudio(song)}
      className={`group relative flex w-[74vw] sm:w-[260px] md:w-[275px] flex-shrink-0 snap-start items-center gap-3 rounded-xl p-3 text-left transition-all duration-200 hover:-translate-y-0.5 ${
        isActive
          ? "border-2 border-accent bg-neutral-50 shadow-xs"
          : "border border-neutral-200 bg-white hover:border-neutral-400/80 shadow-2xs"
      }`}
    >
      <div className="relative shrink-0">
        <SongAvatar title={song.title} size="md" variant="mono" />
        {isActive && (
          <span className="absolute -top-1 -right-1 flex h-2 w-2 rounded-full bg-accent">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-50" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className={`truncate text-xs sm:text-sm font-semibold tracking-tight ${isActive ? "text-accent" : "text-neutral-900"}`}>
            {song.title}
          </p>
          {isNew && (
            <span className="rounded bg-accent px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider text-white">
              New
            </span>
          )}
        </div>
        <p className="truncate text-[11px] font-medium text-neutral-500 mt-0.5">
          {song.author}
        </p>
      </div>

      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-all duration-200 ${
        isActive
          ? "bg-accent text-white"
          : "bg-neutral-100 text-neutral-600 group-hover:bg-accent group-hover:text-white"
      }`}>
        <Play size={12} fill="currentColor" className="ml-0.5" />
      </div>
    </button>
  );
};

// Vertical card (Used in Fresh Releases)
const FeaturedCard = ({ song, onClick, isActive }) => {
  const isNew =
    song.created_at &&
    Date.now() - new Date(song.created_at).getTime() <
      timeWindowDays * 24 * 60 * 60 * 1000;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => prefetchSongAudio(song)}
      className={`group relative flex w-[135px] md:w-[155px] flex-shrink-0 snap-start flex-col items-center gap-2.5 rounded-xl p-3 md:p-3.5 text-center transition-all duration-200 hover:-translate-y-0.5 ${
        isActive
          ? "border-2 border-accent bg-neutral-50 shadow-xs"
          : "border border-neutral-200 bg-white hover:border-neutral-400/80 shadow-2xs"
      }`}
    >
      {isActive && (
        <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-accent">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-50" />
        </span>
      )}

      <div className="relative my-0.5">
        <SongAvatar title={song.title} size="lg" variant="mono" />
        <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-md bg-accent text-white shadow opacity-0 scale-75 transition-all duration-150 group-hover:opacity-100 group-hover:scale-100">
          <Play size={10} fill="currentColor" className="ml-0.5" />
        </div>
      </div>

      <div className="w-full min-w-0 px-0.5">
        <div className="flex items-center justify-center gap-1">
          <p className={`truncate text-xs font-semibold tracking-tight ${isActive ? "text-accent" : "text-neutral-900"}`}>
            {song.title}
          </p>
          {isNew && (
            <span className="rounded bg-accent px-1 py-0.5 text-[7px] font-bold uppercase tracking-wider text-white">
              New
            </span>
          )}
        </div>
        <p className="truncate text-[10px] font-medium text-neutral-500 mt-0.5">
          {song.author}
        </p>
      </div>
    </button>
  );
};

// Album-style showcase card (Used in Featured Anthems) with subtle retro grooves
const SpotifyCard = ({ song, onClick, isActive }) => {
  const letter = initialLetter(song.title);
  const categoryTag = song.category || "Worship";

  return (
    <button
      type="button"
      onClick={() => onClick(song)}
      onMouseEnter={() => prefetchSongAudio(song)}
      className={`group relative flex w-[155px] md:w-[172px] flex-shrink-0 snap-start flex-col rounded-xl p-3 text-left transition-all duration-200 hover:-translate-y-0.5 ${
        isActive
          ? "border-2 border-accent bg-neutral-50 shadow-xs"
          : "border border-neutral-200 bg-white hover:border-neutral-400/80 shadow-2xs"
      }`}
    >
      {/* Retro Lined Cover Art with Concentric Grooves */}
      <div
        className="relative mb-2.5 aspect-square w-full overflow-hidden rounded-lg border border-neutral-800 flex flex-col justify-between p-2.5 retro-grooves shadow-inner"
        style={{ backgroundColor: "#0f172a" }}
      >
        {/* Top Tag: Clean monochromatic badge */}
        <div className="z-10 flex items-center justify-between">
          <span className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
            {categoryTag}
          </span>
          {isActive && (
            <span className="flex h-2 w-2 rounded-full bg-white">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            </span>
          )}
        </div>

        {/* Big Crisp Letter Centerpiece */}
        <div className="z-10 flex items-center justify-center py-1">
          <span className="text-3xl font-black text-white select-none drop-shadow-sm">
            {letter}
          </span>
        </div>

        {/* Hover play trigger */}
        <div className="absolute bottom-2.5 right-2.5 z-20 flex h-8 w-8 items-center justify-center rounded-lg bg-white text-accent shadow-md opacity-0 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0">
          <Play size={13} fill="currentColor" className="ml-0.5" />
        </div>
      </div>

      {/* Track Info */}
      <div className="px-0.5">
        <p className={`truncate text-xs font-bold tracking-tight ${isActive ? "text-accent" : "text-neutral-900"}`}>
          {song.title}
        </p>
        <p className="truncate text-[10px] font-medium text-neutral-500 mt-0.5">
          {song.author}
        </p>
      </div>
    </button>
  );
};

// Tracklist item (Used in Curated Recommendations)
const RecommendationCard = ({ song, index, onClick, isActive }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => prefetchSongAudio(song)}
      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150 border ${
        isActive
          ? "border-2 border-accent bg-neutral-50 shadow-2xs"
          : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/70 shadow-2xs"
      }`}
    >
      <div className="w-5 shrink-0 text-center">
        {isActive ? (
          <div className="waveform text-accent flex h-3.5 justify-center items-end">
            <span /><span /><span /><span />
          </div>
        ) : (
          <span className="text-[11px] font-bold text-neutral-400 group-hover:hidden">
            {String(index + 1).padStart(2, "0")}
          </span>
        )}
        {!isActive && (
          <Play size={11} fill="currentColor" className="hidden text-accent group-hover:inline ml-0.5" />
        )}
      </div>

      <SongAvatar title={song.title} size="sm" variant="mono" />

      <div className="min-w-0 flex-1">
        <p className={`truncate text-xs font-bold tracking-tight ${isActive ? "text-accent" : "text-neutral-900"}`}>
          {song.title}
        </p>
        <p className="truncate text-[10px] font-medium text-neutral-500 mt-0.5">
          {song.author}
        </p>
      </div>

      {song.category && (
        <span className="hidden sm:inline-block rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[9px] font-semibold text-neutral-600">
          {song.category}
        </span>
      )}

      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-150 ${
        isActive
          ? "bg-accent text-white"
          : "bg-neutral-100 text-neutral-500 group-hover:bg-accent group-hover:text-white"
      }`}>
        <Play size={10} fill="currentColor" className="ml-0.5" />
      </div>
    </button>
  );
};

const SectionBlock = ({ id, title, icon: Icon, items, onPlay, onPlayAll, cta, cardType, activeSongId, children }) => {
  const Card = cardType === "spotify" ? SpotifyCard : cardType === "featured" ? FeaturedCard : SongRailCard;
  return (
    <section id={id} className="scroll-mt-24">
      {/* Section Header */}
      <div className="mb-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {Icon && (
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/8 text-accent">
              <Icon size={13} />
            </div>
          )}
          <h2 className="text-sm md:text-base font-bold tracking-tight text-neutral-900">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {onPlayAll && items.length > 0 && (
            <button
              type="button"
              onClick={() => onPlayAll(items[0])}
              className="flex items-center gap-1 rounded-md bg-accent/8 px-2.5 py-1 text-[11px] font-bold text-accent transition hover:bg-accent/15"
            >
              <Play size={10} fill="currentColor" />
              Play All
            </button>
          )}
          {cta && (
            <Link
              href={cta.href}
              className="group flex items-center gap-1 text-[11px] font-semibold text-neutral-500 transition hover:text-neutral-900"
            >
              <span>View all</span>
              <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      </div>

      {children || (
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 pt-0.5 scrollbar-thin [mask-image:linear-gradient(to_right,black_calc(100%-40px),transparent_100%)]">
          {items.length > 0 ? (
            items.map((song) => (
              <Card
                key={song.id}
                song={song}
                isActive={song.id === activeSongId}
                onClick={() => onPlay(song)}
              />
            ))
          ) : (
            <div className="w-full rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 py-8 text-center text-xs font-medium text-neutral-400">
              No songs available in this section yet.
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default function Home() {
  const { allSongs, setAllSongs, setActiveSong, isLoading, setIsLoading, recentlyPlayed, activeSong } =
    usePlayer();
  const { user, profile } = useAuth();
  const [loadError, setLoadError] = useState(false);
  const [verseIndex, setVerseIndex] = useState(0);
  const [showAllRecs, setShowAllRecs] = useState(false);
  const [verseCopied, setVerseCopied] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");

  // Rotate verse periodically when idle
  useEffect(() => {
    const interval = setInterval(() => {
      setVerseIndex((prev) => (prev + 1) % verses.length);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const [sessionSeed] = useState(() => Math.random().toString(36).slice(2));

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

  const sortedSongs = useMemo(() => {
    return [...(allSongs || [])].sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
    );
  }, [allSongs]);

  const songIdsKey = useMemo(
    () => sortedSongs.map((song) => song.id).join(","),
    [sortedSongs]
  );

  const newestSongs = useMemo(() => {
    const cutoff = Date.now() - timeWindowDays * 24 * 60 * 60 * 1000;
    return sortedSongs.filter(
      (song) => song.created_at && new Date(song.created_at).getTime() >= cutoff
    );
  }, [sortedSongs]);

  const featuredSongs = useMemo(() => {
    const praiseFirst = sortedSongs.filter(
      (song) => (song.category || "").toLowerCase() === "praise"
    );
    const mixed = [...praiseFirst, ...sortedSongs].filter(
      (song, index, list) => list.findIndex((item) => item.id === song.id) === index
    );
    return seededShuffle(mixed, `featured-${songIdsKey}-${sessionSeed}`).slice(0, 15);
  }, [songIdsKey, sessionSeed, sortedSongs]);

  const spotifySong = useMemo(() => {
    if (sortedSongs.length === 0) return null;
    const rng = mulberry32(hashStr(`spotlight-${songIdsKey}-${sessionSeed}`));
    return sortedSongs[Math.floor(rng() * Math.min(sortedSongs.length, 5))];
  }, [songIdsKey, sessionSeed, sortedSongs]);

  const recommendedSongs = useMemo(() => {
    if (sortedSongs.length === 0) return [];
    let list = sortedSongs;
    if (activeFilter === "praise") {
      list = sortedSongs.filter(s => (s.category || "").toLowerCase().includes("praise"));
    } else if (activeFilter === "worship") {
      list = sortedSongs.filter(s => (s.category || "").toLowerCase().includes("worship"));
    } else if (activeFilter === "hymns") {
      list = sortedSongs.filter(s => (s.category || "").toLowerCase().includes("hymn"));
    } else if (activeFilter === "new") {
      list = newestSongs;
    }
    return seededShuffle(list, `recommend-${songIdsKey}-${sessionSeed}-${activeFilter}`).slice(0, 30);
  }, [songIdsKey, sessionSeed, sortedSongs, activeFilter, newestSongs]);

  const visibleRecs = showAllRecs ? recommendedSongs : recommendedSongs.slice(0, 8);

  const stats = {
    total: allSongs?.length || 0,
    new: newestSongs.length,
    artists: new Set(sortedSongs.map(s => s.author).filter(Boolean)).size,
  };

  const getGreetingData = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: "Good morning", icon: Sunrise };
    if (hour < 18) return { text: "Good afternoon", icon: Sun };
    return { text: "Good evening", icon: Moon };
  };

  const { text: greetingText, icon: GreetingIcon } = getGreetingData();
  const userName = profile?.first_name || user?.email?.split("@")[0] || null;

  const copyVerse = useCallback(async () => {
    const verse = verses[verseIndex];
    const text = `"${verse.text}" — ${verse.ref}`;
    try {
      await navigator.clipboard.writeText(text);
      setVerseCopied(true);
      setTimeout(() => setVerseCopied(false), 2000);
    } catch {
      // fallback
    }
  }, [verseIndex]);

  const shuffleAll = useCallback(() => {
    if (sortedSongs.length > 0) {
      const shuffled = [...sortedSongs].sort(() => Math.random() - 0.5);
      setActiveSong(shuffled[0], shuffled);
    }
  }, [sortedSongs, setActiveSong]);

  const filterCategories = [
    { id: "all", label: "All Songs" },
    { id: "praise", label: "Praise" },
    { id: "worship", label: "Worship" },
    { id: "hymns", label: "Hymns" },
    { id: "new", label: "New Releases" },
  ];

  return (
    <main className="min-h-[90vh] bg-white px-3 sm:px-6 md:px-8 pb-12 pt-3 md:pt-5">
      <ScrollProgress />
      <div className="mx-auto max-w-5xl space-y-6 md:space-y-7">

        {/* --- COMPACT HERO BANNER WITH SUBTLE RETRO BORDER --- */}
        <section className="relative overflow-hidden rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 md:p-6 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            
            {/* Left side: Greeting, Title, Action Buttons, Metrics */}
            <div className="flex-1 min-w-0 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
                  <GreetingIcon size={12} className="text-accent" />
                  <span>
                    {greetingText}
                    {userName && <>, <strong className="text-neutral-900 font-bold">{userName}</strong></>}
                  </span>
                </span>
              </div>

              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
                  Worship in Song
                </h1>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Sacred hymns, praise anthems, and uplifting worship melodies.
                </p>
              </div>

              {/* Action Buttons & Library Counts */}
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={shuffleAll}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-accent/90"
                >
                  <Shuffle size={12} />
                  <span>Shuffle All</span>
                </button>

                {recentlyPlayed.length > 0 && (
                  <a
                    href="#recently-played"
                    className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 transition"
                  >
                    <Clock size={12} className="text-neutral-500" />
                    <span>Recent ({recentlyPlayed.length})</span>
                  </a>
                )}

                <div className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50/70 px-2.5 py-1.5 text-[11px] font-medium text-neutral-500">
                  <span className="font-bold text-neutral-800">{stats.total}</span> tracks
                  <span className="text-neutral-300">•</span>
                  <span className="font-bold text-neutral-800">{stats.artists}</span> artists
                  {stats.new > 0 && (
                    <>
                      <span className="text-neutral-300">•</span>
                      <span className="font-bold text-accent">{stats.new} new</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right side: Compact Live Playback or Scripture Capsule */}
            <div className="w-full md:w-auto shrink-0 border-t md:border-t-0 md:border-l border-neutral-100 pt-3 md:pt-0 md:pl-5">
              {activeSong ? (
                <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-2.5 sm:w-64">
                  <SongAvatar title={activeSong.title} size="sm" variant="mono" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-accent">
                      Now Playing
                    </span>
                    <p className="truncate text-xs font-bold text-neutral-900">
                      {activeSong.title}
                    </p>
                    <p className="truncate text-[10px] text-neutral-500">
                      {activeSong.author}
                    </p>
                  </div>
                  <div className="waveform text-accent flex h-4 items-end">
                    <span /><span /><span /><span />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2.5 rounded-lg border border-neutral-200 bg-neutral-50 p-2.5 sm:max-w-xs text-left">
                  <div className="flex items-start gap-2 min-w-0">
                    <Quote size={12} className="text-accent shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[11px] italic text-neutral-700 leading-snug line-clamp-2">
                        “{verses[verseIndex].text}”
                      </p>
                      <p className="text-[9px] font-bold text-accent mt-0.5">
                        {verses[verseIndex].ref}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={copyVerse}
                    className="shrink-0 p-1 text-neutral-400 hover:text-neutral-700 transition"
                    title="Copy verse"
                  >
                    {verseCopied ? <Check size={12} className="text-accent font-bold" /> : <Copy size={12} />}
                  </button>
                </div>
              )}
            </div>

          </div>
        </section>

        {/* --- COMPACT CATEGORY FILTER PILLS --- */}
        <section className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          <div className="flex items-center gap-1 shrink-0 text-[11px] font-bold text-neutral-400 pr-1">
            <Compass size={13} />
            <span>Filter:</span>
          </div>
          {filterCategories.map((cat) => {
            const isSelected = activeFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveFilter(cat.id)}
                className={`shrink-0 rounded-lg px-3 py-1 text-xs font-semibold transition-all duration-150 ${
                  isSelected
                    ? "bg-accent text-white shadow-2xs"
                    : "bg-white text-neutral-700 border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </section>

        {/* --- MAIN CONTENT SECTIONS --- */}
        {isLoading ? (
          <PageSkeleton letterGroups={3} />
        ) : (
          <div className="space-y-6 md:space-y-7">
            {loadError && (
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold text-neutral-800">
                Songs could not be loaded. Check your connection or Supabase configuration and try again.
              </div>
            )}

            {/* --- COMPACT PLAY SPOTLIGHT BANNER (Guaranteed Dark Background + 100% White Text Contrast) --- */}
            {spotifySong && (
              <LazySection>
                <section className="scroll-mt-24">
                  <div
                    className="relative overflow-hidden rounded-xl border border-neutral-800 p-4 md:p-5 text-white shadow-sm"
                    style={{ backgroundColor: "#0f172a", color: "#ffffff" }}
                    onMouseEnter={() => prefetchSongAudio(spotifySong)}
                  >
                    <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Artwork container with retro grooves */}
                        <div
                          className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-white/20 text-2xl font-black text-white shadow-sm retro-grooves"
                          style={{ backgroundColor: "#0f172a" }}
                        >
                          {initialLetter(spotifySong.title)}
                        </div>

                        {/* Metadata in pure, guaranteed white text */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="inline-flex items-center gap-1 rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
                              <Star size={9} fill="currentColor" />
                              Spotlight
                            </span>
                            {spotifySong.category && (
                              <span className="rounded border border-white/15 px-1.5 py-0.5 text-[8px] font-semibold text-neutral-300 uppercase tracking-wider">
                                {spotifySong.category}
                              </span>
                            )}
                          </div>
                          <h3 className="truncate text-sm sm:text-base font-bold text-white">
                            {spotifySong.title}
                          </h3>
                          <p className="truncate text-xs text-neutral-300 mt-0.5">
                            {spotifySong.author}
                          </p>
                        </div>
                      </div>

                      {/* Play Action: Pure white button with dark text */}
                      <button
                        type="button"
                        onClick={() => setActiveSong(spotifySong, sortedSongs)}
                        className="inline-flex items-center justify-center gap-1.5 self-start sm:self-auto rounded-lg bg-white px-4 py-2 text-xs font-bold text-[#0f172a] shadow-sm transition hover:bg-neutral-100 active:scale-95 shrink-0"
                      >
                        <Play size={12} fill="currentColor" />
                        <span>Play Spotlight</span>
                      </button>
                    </div>
                  </div>
                </section>
              </LazySection>
            )}

            {/* --- FEATURED ANTHEMS SECTION --- */}
            <LazySection delay={50}>
              <SectionBlock
                id="featured-songs"
                title="Featured Anthems"
                icon={Star}
                items={featuredSongs}
                onPlay={(song) => setActiveSong(song, featuredSongs)}
                onPlayAll={(song) => setActiveSong(song, featuredSongs)}
                activeSongId={activeSong?.id}
                cta={{ href: "/songs" }}
                cardType="spotify"
              />
            </LazySection>

            {/* --- FRESH RELEASES SECTION --- */}
            <LazySection delay={100}>
              <SectionBlock
                id="newest-songs"
                title="Fresh Releases"
                icon={Sparkles}
                items={newestSongs}
                onPlay={(song) => setActiveSong(song, newestSongs)}
                onPlayAll={(song) => setActiveSong(song, newestSongs)}
                activeSongId={activeSong?.id}
                cta={{ href: "/songs" }}
                cardType="featured"
              />
            </LazySection>

            {/* --- JUMP BACK IN SECTION --- */}
            {recentlyPlayed.length > 0 && (
              <LazySection delay={150}>
                <SectionBlock
                  id="recently-played"
                  title="Jump Back In"
                  icon={Clock}
                  items={recentlyPlayed}
                  onPlay={(song) => setActiveSong(song, recentlyPlayed)}
                  activeSongId={activeSong?.id}
                />
              </LazySection>
            )}

            {/* --- CURATED RECOMMENDATIONS LIST --- */}
            {recommendedSongs.length > 0 && (
              <LazySection delay={200}>
                <section id="recommended" className="scroll-mt-24">
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/8 text-accent">
                        <ListMusic size={13} />
                      </div>
                      <h2 className="text-sm md:text-base font-bold tracking-tight text-neutral-900">
                        Curated for You
                      </h2>
                    </div>
                    {recommendedSongs.length > 8 && (
                      <button
                        type="button"
                        onClick={() => setShowAllRecs(!showAllRecs)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-neutral-500 transition hover:text-neutral-900"
                      >
                        <span>{showAllRecs ? "Show less" : `Show all (${recommendedSongs.length})`}</span>
                        {showAllRecs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {visibleRecs.map((song, idx) => (
                      <RecommendationCard
                        key={song.id}
                        song={song}
                        index={idx}
                        isActive={song.id === activeSong?.id}
                        onClick={() => setActiveSong(song, recommendedSongs)}
                      />
                    ))}
                  </div>
                </section>
              </LazySection>
            )}

            {/* --- EMPTY STATE --- */}
            {sortedSongs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-100 border border-neutral-200">
                  <Sparkles className="text-accent" size={24} />
                </div>
                <p className="text-base font-bold tracking-tight text-neutral-900">
                  Your library is empty
                </p>
                <p className="mt-1 max-w-xs text-xs leading-relaxed text-neutral-500">
                  Upload your first worship song and start building your collection. Songs will appear here automatically.
                </p>
                <Link
                  href="/admin"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-accent/90"
                >
                  <Upload size={13} />
                  Upload a Song
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
