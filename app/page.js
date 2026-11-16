"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/apiFetch";
import { usePlayer } from "./context/PlayerContext";
import { useAuth } from "./context/AuthContext";
import { PageSkeleton } from "./components/Skeleton";
import SongAvatar, { initialLetter, hashStr } from "./components/SongAvatar";
import FeaturedCard from "./components/FeaturedCard";
import {
  Music,
  ArrowRight,
  ArrowUp,
  Play,
  Upload,
  Sparkles,
  Star,
  Clock,
  ListMusic,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Pause,
  Shuffle,
  Sun,
  Sunrise,
  Moon,
  Quote,
  Compass,
} from "lucide-react";
import LazySection from "./components/LazySection";
import { prefetchSongAudio } from "@/lib/prefetchAudio";
import { getNewestSongs } from "@/lib/newSongs";

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

// Rail sizes shrink with small libraries so Featured / Fresh / Explore
// don't just repeat the same handful of songs at each other.
const railSize = (total, base) =>
  total >= base * 2 ? base : Math.max(4, Math.ceil(total / 3));

const ScrollToTop = ({ visible }) => {
  if (!visible) return null;
  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => {
        const scroller = document.getElementById("app-scroll");
        if (scroller) {
          scroller.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
        } else {
          window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
        }
      }}
      className="fixed left-4 bottom-40 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white shadow-lg transition hover:bg-accent/90 active:scale-95 md:bottom-24 lg:left-auto lg:right-8"
    >
      <ArrowUp size={18} />
    </button>
  );
};

/* --- COMPACT, RETRO-LINED MONOCHROMATIC CARD COMPONENTS --- */

// Horizontal pill card (Used in Jump Back In / Rails)
// "New" badge is rank-based (recent 15) — parent passes isNew explicitly.
const SongRailCard = ({ song, onClick, isActive, isNew = false }) => {

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => prefetchSongAudio(song)}
      aria-current={isActive ? "true" : undefined}
      aria-label={`Play: ${song.title} by ${song.author || "Unknown artist"}`}
      className={`group relative flex w-[74vw] sm:w-[260px] md:w-[275px] flex-shrink-0 snap-start items-center gap-3 rounded-xl p-3 text-left transition-all duration-200 hover:-translate-y-0.5 ${
        isActive
          ? "border border-accent bg-neutral-50 ring-1 ring-inset ring-accent"
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
          <p className={`min-w-0 flex-1 truncate text-sm font-semibold leading-5 ${isActive ? "text-accent" : "text-neutral-900"}`}>
            {song.title}
          </p>
          {isNew && (
            <span className="rounded bg-gold/10 px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wider text-gold">
              New
            </span>
          )}
        </div>
        <p className="truncate text-xs font-medium text-neutral-500 mt-0.5">
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

// Vertical card shared with the songs page (see ./components/FeaturedCard)

// Album-style showcase card (used in Featured) with subtle retro grooves
const SpotifyCard = ({ song, onClick, isActive, isNew = false }) => {
  const letter = initialLetter(song.title);
  const categoryTag = song.category || "Worship";

  return (
    <button
      type="button"
      onClick={() => onClick(song)}
      onMouseEnter={() => prefetchSongAudio(song)}
      aria-current={isActive ? "true" : undefined}
      aria-label={`Play: ${song.title} by ${song.author || "Unknown artist"}`}
      className={`group relative flex w-[160px] max-w-full md:w-[184px] shrink-0 snap-start flex-col rounded-xl p-3 text-left transition-colors ${
        isActive
          ? "border border-accent bg-neutral-50 ring-1 ring-inset ring-accent"
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
          <span className="max-w-full truncate rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
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
        <div className="absolute bottom-2.5 right-2.5 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white text-accent shadow-sm">
          <Play size={13} fill="currentColor" className="ml-0.5" />
        </div>
      </div>

      {/* Track Info */}
      <div className="w-full min-w-0 px-0.5">
        <div className="flex items-start gap-1.5">
          <p className={`line-clamp-2 min-h-10 min-w-0 flex-1 text-sm font-semibold leading-5 break-words ${isActive ? "text-accent" : "text-neutral-900"}`}>
            {song.title}
          </p>
          {isNew && (
            <span className="shrink-0 rounded bg-gold/10 px-1 py-0.5 text-[10px] font-normal uppercase tracking-wider text-gold">
              New
            </span>
          )}
        </div>
        <p className="truncate text-xs font-medium text-neutral-500 mt-0.5">
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
      aria-current={isActive ? "true" : undefined}
      aria-label={`Play: ${song.title} by ${song.author || "Unknown artist"}`}
      className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-150 border ${
        isActive
          ? "border-accent bg-neutral-50 ring-1 ring-inset ring-accent"
          : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/70 shadow-2xs"
      }`}
    >
      <div className="w-5 shrink-0 text-center">
        {isActive ? (
          <div className="waveform text-accent flex h-3.5 justify-center items-end">
            <span /><span /><span /><span />
          </div>
        ) : (
          <span className="text-xs font-bold text-neutral-600 group-hover:hidden">
            {String(index + 1).padStart(2, "0")}
          </span>
        )}
        {!isActive && (
          <Play size={11} fill="currentColor" className="hidden text-accent group-hover:inline ml-0.5" />
        )}
      </div>

      <SongAvatar title={song.title} size="sm" variant="mono" />

      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-semibold leading-5 ${isActive ? "text-accent" : "text-neutral-900"}`}>
          {song.title}
        </p>
        <p className="truncate text-xs font-medium text-neutral-500 mt-0.5">
          {song.author}
        </p>
      </div>

      {song.category && (
        <span className="hidden sm:inline-block rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-semibold text-neutral-600">
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

// History row (Used in Jump Back In) — vertical timeline list, distinct from rails
const HistoryCard = ({ song, index, onClick, isActive, isNew = false, isHistory = true }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => prefetchSongAudio(song)}
      aria-current={isActive ? "true" : undefined}
      aria-label={`Play: ${song.title} by ${song.author || "Unknown artist"}`}
      className={`group flex w-[min(80vw,320px)] max-w-full shrink-0 snap-start items-center gap-2.5 rounded-lg border px-3 py-3 text-left transition-colors ${
        isActive
          ? "border-accent bg-accent/[0.04]"
          : "border-neutral-200 bg-neutral-50/60 hover:border-accent/40 hover:bg-neutral-50"
      }`}
    >
      <div className="w-7 shrink-0 text-center">
        {isActive ? (
          <div className="waveform text-accent flex h-3.5 justify-center items-end">
            <span /><span /><span /><span />
          </div>
        ) : (
          <span className="text-xs font-black tabular-nums text-neutral-600 group-hover:hidden">
            {String(index + 1).padStart(2, "0")}
          </span>
        )}
        {!isActive && (
          <Play size={11} fill="currentColor" className="hidden text-accent group-hover:inline ml-1.5" />
        )}
      </div>

      <SongAvatar title={song.title} size="sm" variant="mono" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className={`truncate text-sm font-semibold leading-5 ${isActive ? "text-accent" : "text-neutral-900"}`}>
            {song.title}
          </p>
          {index === 0 && isHistory && !isActive && (
            <span className="shrink-0 text-[10px] font-medium text-neutral-500">
              Last played
            </span>
          )}
          {isNew && (
            <span className="shrink-0 rounded bg-gold/10 px-1 py-0.5 text-[10px] font-normal uppercase tracking-wider text-gold">
              New
            </span>
          )}
        </div>
        <p className="truncate text-xs font-medium text-neutral-500 mt-0.5">
          {song.author}
        </p>
      </div>

      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-150 ${
        isActive
          ? "bg-accent text-white"
          : "bg-white text-neutral-500 border border-neutral-200 group-hover:bg-accent group-hover:border-accent group-hover:text-white"
      }`}>
        <Play size={11} fill="currentColor" className="ml-0.5" />
      </div>
    </button>
  );
};

const SectionBlock = ({ id, title, icon: Icon, items, onPlay, onPlayAll, cta, cardType, activeSongId, newSongIds, isHistory = false }) => {
  const Card = cardType === "spotify" ? SpotifyCard : cardType === "featured" ? FeaturedCard : cardType === "history" ? HistoryCard : SongRailCard;
  const scrollRef = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const updateEdges = useCallback(() => {
    const rail = scrollRef.current;
    if (!rail) return;
    const left = rail.scrollLeft > 2;
    const right = rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 2;
    setEdges((prev) => prev.left === left && prev.right === right ? prev : { left, right });
  }, []);

  useEffect(() => {
    const rail = scrollRef.current;
    if (!rail) return;
    const observer = new ResizeObserver(updateEdges);
    observer.observe(rail);
    for (const card of rail.children) observer.observe(card);
    updateEdges();
    return () => observer.disconnect();
  }, [items, updateEdges]);

  const scrollRail = (direction) => {
    const rail = scrollRef.current;
    rail?.scrollBy({
      left: direction * rail.clientWidth * 0.8,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  };

  if (items.length === 0) return null;
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="min-w-0 scroll-mt-4">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {Icon && <Icon size={18} className="shrink-0 text-neutral-500" aria-hidden="true" />}
          <h2 id={`${id}-title`} className="section-title">{title}</h2>
        </div>
        {cta && (
          <Link href={cta.href} aria-label={`View all ${title.toLowerCase()}`} className="tap-sm inline-flex shrink-0 items-center gap-1 rounded-md text-xs font-semibold text-neutral-600 transition hover:text-accent">
            View all <ArrowRight size={14} aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className="mb-2 flex items-center justify-between gap-2">
        {onPlayAll && (
          <button type="button" onClick={() => onPlayAll(items[0])} aria-label={`Play all ${title.toLowerCase()}`} className="tap-sm inline-flex min-h-8.5 items-center gap-1.5 rounded-lg bg-accent/8 px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/15">
            <Play size={14} fill="currentColor" aria-hidden="true" /> Play all
          </button>
        )}
        {(edges.left || edges.right) && (
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => scrollRail(-1)} disabled={!edges.left} aria-label={`Scroll ${title} left`} aria-controls={`${id}-rail`} className="tap-sm flex h-8.5 w-8.5 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition hover:bg-neutral-100 disabled:cursor-default disabled:opacity-30">
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => scrollRail(1)} disabled={!edges.right} aria-label={`Scroll ${title} right`} aria-controls={`${id}-rail`} className="tap-sm flex h-8.5 w-8.5 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition hover:bg-neutral-100 disabled:cursor-default disabled:opacity-30">
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      <div
        id={`${id}-rail`}
        ref={scrollRef}
        role="region"
        aria-label={`${title} — scrollable songs`}
        tabIndex={0}
        onScroll={updateEdges}
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          e.preventDefault();
          scrollRail(e.key === "ArrowRight" ? 1 : -1);
        }}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain p-1 -m-1 no-scrollbar"
      >
        {items.map((song, index) => (
          <Card key={song.id} song={song} index={index} isHistory={isHistory} isActive={song.id === activeSongId} isNew={newSongIds?.has(song.id) || false} onClick={() => onPlay(song)} />
        ))}
      </div>
    </section>
  );
};

export default function Home() {
  const { allSongs, setAllSongs, setActiveSong, isLoading, setIsLoading, recentlyPlayed, activeSong, hasRealHistory } =
    usePlayer();
  const { profile, isAdmin } = useAuth();
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [verseIndex, setVerseIndex] = useState(0);
  const [verseCopyState, setVerseCopyState] = useState("idle");
  const [versePaused, setVersePaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [scrollY, setScrollY] = useState(0);

  // The app scrolls inside #app-scroll, not window.
  useEffect(() => {
    const scroller = document.getElementById("app-scroll");
    if (!scroller) return;
    const handleScroll = () => {
      setScrollY(scroller.scrollTop);
    };
    handleScroll();
    scroller.addEventListener("scroll", handleScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", handleScroll);
  }, []);

  // WCAG 2.2.2: the capsule updates on its own, so it needs a stop control and
  // has to respect reduced motion. It also only rotates while it is on screen —
  // a playing track replaces it with the Now Playing card.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (activeSong || versePaused || reduceMotion) return;
    const interval = setInterval(() => {
      setVerseIndex((prev) => (prev + 1) % verses.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [activeSong, versePaused, reduceMotion]);

  const [sessionSeed] = useState(() => Math.random().toString(36).slice(2));

  useEffect(() => {
    let cancelled = false;
    const fetchSongs = async () => {
      setIsLoading(true);
      setLoadError(false);
      try {
        const data = await apiFetch("/api/data/songs?order=title&ascending=true");
        if (!cancelled && data) setAllSongs(data);
      } catch (error) {
        if (!cancelled) {
          console.error("Error:", error);
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void fetchSongs();
    return () => { cancelled = true; };
  }, [setAllSongs, setIsLoading, loadAttempt]);

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
    // "New" = 15 most recently added songs (rank-based, not a time window).
    // This same list drives the NEW badge + Fresh Releases section.
    return getNewestSongs(sortedSongs);
  }, [sortedSongs]);

  const newSongIds = useMemo(
    () => new Set(newestSongs.map((song) => song.id)),
    [newestSongs]
  );

  const featuredSongs = useMemo(() => {
    const praiseFirst = sortedSongs.filter(
      (song) => (song.category || "").toLowerCase() === "praise"
    );
    const mixed = [...praiseFirst, ...sortedSongs].filter(
      (song, index, list) => list.findIndex((item) => item.id === song.id) === index
    );
    return seededShuffle(mixed, `featured-${songIdsKey}-${sessionSeed}`).slice(0, railSize(sortedSongs.length, 15));
  }, [songIdsKey, sessionSeed, sortedSongs]);

  const keepExploring = useMemo(() => {
    const exclude = new Set([
      ...featuredSongs.map((s) => s.id),
      ...newestSongs.map((s) => s.id),
    ]);
    const rest = sortedSongs.filter((s) => !exclude.has(s.id));
    return seededShuffle(rest, `explore-${songIdsKey}-${sessionSeed}`).slice(0, railSize(sortedSongs.length, 12));
  }, [sortedSongs, featuredSongs, newestSongs, songIdsKey, sessionSeed]);

  const spotifySong = useMemo(() => {
    if (sortedSongs.length === 0) return null;
    const rng = mulberry32(hashStr(`spotlight-${songIdsKey}-${sessionSeed}`));
    // The whole catalogue, not the 10 newest: sortedSongs is newest-first, so a
    // capped pool left every older recording permanently unspotlighted once the
    // library passed ten uploads.
    return sortedSongs[Math.floor(rng() * sortedSongs.length)];
  }, [songIdsKey, sessionSeed, sortedSongs]);

  const recommendedSongs = useMemo(() => {
    if (sortedSongs.length === 0) return [];
    let list = sortedSongs;
    if (activeFilter === "praise") {
      list = sortedSongs.filter(s => (s.category || "").toLowerCase().includes("praise"));
    } else if (activeFilter === "worship") {
      list = sortedSongs.filter(s => (s.category || "").toLowerCase().includes("worship"));
    } else if (activeFilter === "short") {
      list = sortedSongs.filter((s) => (s.duration || "Long") === "Short");
    } else if (activeFilter === "new") {
      list = newestSongs;
    }
    return seededShuffle(list, `recommend-${songIdsKey}-${sessionSeed}-${activeFilter}`).slice(0, 15);
  }, [songIdsKey, sessionSeed, sortedSongs, activeFilter, newestSongs]);

  const stats = {
    total: allSongs?.length || 0,
    artists: new Set(sortedSongs.map(s => s.author).filter(Boolean)).size,
  };

  const getGreetingData = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: "Good morning", icon: Sunrise };
    if (hour < 18) return { text: "Good afternoon", icon: Sun };
    return { text: "Good evening", icon: Moon };
  };

  const { text: greetingText, icon: GreetingIcon } = getGreetingData();
  // Only a name the user actually gave us. An email handle reads like a
  // username, not a greeting.
  const userName = profile?.first_name || null;

  const copyVerse = useCallback(async () => {
    const verse = verses[verseIndex];
    const text = `"${verse.text}" — ${verse.ref}`;
    try {
      // navigator.clipboard is absent outside secure contexts, which throws
      // here rather than failing the write quietly.
      await navigator.clipboard.writeText(text);
      setVerseCopyState("copied");
    } catch {
      setVerseCopyState("failed");
    }
    setTimeout(() => setVerseCopyState("idle"), 2500);
  }, [verseIndex]);

  const shuffleAll = useCallback(() => {
    if (sortedSongs.length > 0) {
      // Seeded so the order is an unbiased Fisher-Yates rather than a
      // comparator shuffle. The seed stays fresh per press, unlike the rails,
      // which pin their order for the session.
      const shuffled = seededShuffle(sortedSongs, `shuffle-all-${Math.random()}`);
      setActiveSong(shuffled[0], shuffled);
    }
  }, [sortedSongs, setActiveSong]);

  const filterCategories = [
    { id: "all", label: "All" },
    { id: "praise", label: "Praise" },
    { id: "worship", label: "Worship" },
    { id: "short", label: "Short" },
    { id: "new", label: "New" },
  ];

  return (
    <div className="bg-white px-3 pb-8 pt-4 sm:px-6 md:px-8 md:pt-6">
      <ScrollToTop visible={scrollY > 400} />
      <div className="mx-auto max-w-5xl space-y-6 md:space-y-7">

        {/* --- COMPACT HERO BANNER WITH SUBTLE RETRO BORDER --- */}
        <section className="relative overflow-hidden rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 md:p-6 shadow-2xs">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            
            {/* Left side: Greeting, Title, Action Buttons, Metrics */}
            <div className="flex-1 min-w-0 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-semibold text-neutral-700">
                  <GreetingIcon size={12} className="text-accent" />
                  <span>
                    {greetingText}
                    {userName && <>, <strong className="text-neutral-900 font-bold">{userName}</strong></>}
                  </span>
                </span>
              </div>

              <div>
                <h1 className="page-title">Worship Sessions</h1>
                <p className="mt-1 max-w-md text-sm leading-relaxed text-neutral-500">
                  Praise and worship to sing along with, any time of day.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={shuffleAll}
                  disabled={sortedSongs.length === 0}
                  className="btn-primary"
                >
                  <Shuffle size={16} aria-hidden="true" />
                  <span>Shuffle All</span>
                </button>
                <Link href="/songs" className="tap-sm inline-flex min-h-9 items-center gap-1.5 rounded-full px-2 py-2 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100 hover:text-accent">
                  Browse songs <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
              {!isLoading && stats.total > 0 && (
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
                  <span>{stats.total} {stats.total === 1 ? "track" : "tracks"}</span>
                  <span aria-hidden="true">·</span>
                  <span>{stats.artists} {stats.artists === 1 ? "artist" : "artists"}</span>
                  {hasRealHistory && recentlyPlayed.length > 0 && (
                    <a href="#recently-played" className="tap-sm inline-flex items-center gap-1 rounded-md font-semibold text-accent hover:underline">
                      <Clock size={13} aria-hidden="true" /> Recently played
                    </a>
                  )}
                </p>
              )}
            </div>

            {/* Right side: Compact Live Playback or Scripture Capsule */}
            <div className="min-w-0 w-full shrink-0 border-t border-neutral-100 pt-3 lg:w-64 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
              {activeSong ? (
                <div className="flex min-w-0 items-center gap-3 w-full">
                  <SongAvatar title={activeSong.title} size="sm" variant="mono" />
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-medium text-neutral-500">In your player</span>
                    <p className="truncate text-sm font-semibold text-neutral-900">{activeSong.title}</p>
                    <p className="truncate text-xs text-neutral-500">{activeSong.author}</p>
                  </div>
                </div>
              ) : (
                <div className="flex min-w-0 items-start justify-between gap-2 text-left w-full">
                  <div className="flex items-start gap-2 min-w-0">
                    <Quote size={12} className="text-accent shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs italic text-neutral-700 leading-snug line-clamp-2">
                        “{verses[verseIndex].text}”
                      </p>
                      <p className="text-xs font-bold text-accent mt-0.5">
                        {verses[verseIndex].ref}
                      </p>
                      {verseCopyState === "failed" && (
                        <p role="alert" className="mt-1 text-xs font-semibold text-red-600">
                          Couldn’t copy — select the verse and copy it by hand.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center">
                    {!reduceMotion && (
                      <button
                        type="button"
                        onClick={() => setVersePaused((p) => !p)}
                        aria-pressed={versePaused}
                        aria-label={versePaused ? "Resume verse rotation" : "Pause verse rotation"}
                        title={versePaused ? "Resume verse rotation" : "Pause verse rotation"}
                        className="tap-sm shrink-0 rounded-lg p-1.5 text-neutral-400 hover:text-neutral-700 transition"
                      >
                        {versePaused ? <Play size={14} /> : <Pause size={14} />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={copyVerse}
                      aria-label={verseCopyState === "copied" ? "Verse copied" : "Copy verse"}
                      className="tap-sm shrink-0 rounded-lg p-1.5 text-neutral-400 hover:text-neutral-700 transition"
                      title="Copy verse"
                    >
                      {verseCopyState === "copied" ? <Check size={14} className="text-accent font-bold" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </section>

        {/* --- MAIN CONTENT SECTIONS --- */}
        {isLoading ? (
          <PageSkeleton letterGroups={3} />
        ) : (
          <div className="space-y-6 md:space-y-7">
            {loadError && (
              <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-sm text-neutral-700">Songs could not be loaded. Check your connection and try again.</p>
                <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)} className="tap-sm inline-flex min-h-8.5 items-center rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white">
                  Try again
                </button>
              </div>
            )}
            {hasRealHistory && recentlyPlayed.length > 0 && (
              <SectionBlock
                id="recently-played"
                title="Jump Back In"
                icon={Clock}
                items={recentlyPlayed}
                onPlay={(song) => setActiveSong(song, recentlyPlayed)}
                onPlayAll={(song) => setActiveSong(song, recentlyPlayed)}
                activeSongId={activeSong?.id}
                newSongIds={newSongIds}
                cardType="history"
                isHistory
              />
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
                      <div className="flex min-w-0 flex-1 items-center gap-3.5">
                        {/* Artwork container with retro grooves */}
                        <div
                          className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-white/20 text-2xl font-black text-white shadow-sm retro-grooves"
                          style={{ backgroundColor: "#0f172a" }}
                        >
                          {initialLetter(spotifySong.title)}
                        </div>

                        {/* Metadata in pure, guaranteed white text */}
                        <div className="min-w-0">
                          <div className="mb-1 flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
                              <Star size={9} fill="currentColor" />
                              Spotlight
                            </span>
                            {spotifySong.category && (
                              <span className="rounded border border-white/15 px-1.5 py-0.5 text-xs font-semibold text-neutral-300 uppercase tracking-wider">
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
                        className="tap-sm inline-flex min-h-9 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-white px-4 py-2 text-xs font-semibold text-accent transition hover:bg-neutral-100 active:scale-95 sm:self-auto"
                      >
                        <Play size={14} fill="currentColor" />
                        <span>Play Spotlight</span>
                      </button>
                    </div>
                  </div>
                </section>
              </LazySection>
            )}

            {/* --- FEATURED --- */}
            <LazySection delay={50}>
              <SectionBlock
                id="featured-songs"
                title="Featured"
                icon={Star}
                items={featuredSongs}
                onPlay={(song) => setActiveSong(song, featuredSongs)}
                onPlayAll={(song) => setActiveSong(song, featuredSongs)}
                activeSongId={activeSong?.id}
                newSongIds={newSongIds}
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
                newSongIds={newSongIds}
                cta={{ href: "/songs" }}
                cardType="featured"
              />
            </LazySection>

            {!hasRealHistory && recentlyPlayed.length > 0 && (
              <LazySection>
                <SectionBlock
                  id="suggested-starters"
                  title="Suggested Starters"
                  icon={Compass}
                  items={recentlyPlayed}
                  onPlay={(song) => setActiveSong(song, recentlyPlayed)}
                  onPlayAll={(song) => setActiveSong(song, recentlyPlayed)}
                  activeSongId={activeSong?.id}
                  newSongIds={newSongIds}
                  cardType="history"
                />
              </LazySection>
            )}

            {keepExploring.length > 0 && (
              <LazySection>
                <SectionBlock
                  id="keep-exploring"
                  title="Keep Exploring"
                  icon={Shuffle}
                  items={keepExploring}
                  onPlay={(song) => setActiveSong(song, keepExploring)}
                  onPlayAll={(song) => setActiveSong(song, keepExploring)}
                  activeSongId={activeSong?.id}
                  newSongIds={newSongIds}
                  cta={{ href: "/songs" }}
                />
              </LazySection>
            )}

            {/* --- CURATED RECOMMENDATIONS LIST --- */}
            {(recommendedSongs.length > 0 || activeFilter !== "all") && (
              <LazySection delay={200}>
                <section id="recommended" className="scroll-mt-24">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/8 text-accent">
                        <ListMusic size={13} />
                      </div>
                      <h2 className="text-base md:text-lg font-bold tracking-tight text-neutral-900">
                        Curated for You
                      </h2>
                    </div>
                    <div className="flex items-center gap-2">
                      {recommendedSongs.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setActiveSong(recommendedSongs[0], recommendedSongs)}
                          className="tap-sm flex items-center gap-1.5 rounded-lg bg-accent/8 px-3 py-1.5 text-xs font-bold text-accent transition hover:bg-accent/15"
                        >
                          <Play size={12} fill="currentColor" />
                          Play All
                        </button>
                      )}
                      <Link
                        href="/songs"
                        className="group flex items-center gap-1 text-xs font-semibold text-neutral-500 transition hover:text-neutral-900"
                      >
                        <span>View all</span>
                        <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </div>
                  </div>

                  <div
                    role="group"
                    aria-label="Filter Curated for You"
                    className="mb-3 flex flex-wrap items-center gap-1.5"
                  >
                    {filterCategories.map((cat) => {
                      const isSelected = activeFilter === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setActiveFilter(cat.id)}
                          className={`tap-sm min-h-8.5 shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                            isSelected
                              ? "border-accent bg-accent text-white"
                              : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
                          }`}
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Short results must not clamp the page scroll and move the filters. */}
                  <div className="flex min-h-[60dvh] flex-col gap-2">
                    {recommendedSongs.length > 0 ? (
                      [0, 1, 2, 3, 4].map((group) => {
                        const chunk = recommendedSongs.slice(group * 5, group * 5 + 5);
                        if (chunk.length === 0) return null;
                        return (
                          <div key={group} className="flex flex-col gap-2">
                            {chunk.map((song, idx) => (
                              <RecommendationCard
                                key={song.id}
                                song={song}
                                index={group * 5 + idx}
                                isActive={song.id === activeSong?.id}
                                onClick={() => setActiveSong(song, recommendedSongs)}
                              />
                            ))}
                          </div>
                        );
                      })
                    ) : (
                      <div className="w-full rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 py-8 text-center text-xs font-medium text-neutral-400">
                        No songs match this filter yet — try another one.
                      </div>
                    )}
                  </div>
                </section>
              </LazySection>
            )}

            {/* --- EMPTY STATE --- */}
            {!loadError && sortedSongs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-100 border border-neutral-200">
                  <Sparkles className="text-accent" size={24} />
                </div>
                <p className="text-base font-bold tracking-tight text-neutral-900">
                  {isAdmin ? "Your library is empty" : "No songs yet"}
                </p>
                <p className="mt-1 max-w-xs text-xs leading-relaxed text-neutral-500">
                  {isAdmin
                    ? "Upload your first worship song and start building your collection. Songs will appear here automatically."
                    : "The collection is still being built. New recordings appear here as soon as they are added."}
                </p>
                {isAdmin && (
                  <Link
                    href="/upload"
                    className="tap-lg mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-white shadow-2xs transition hover:bg-accent/90"
                  >
                    <Upload size={15} />
                    Upload a Song
                  </Link>
                )}
              </div>
            )}

            {/* --- END OF FEED --- */}
            {sortedSongs.length > 0 && (
              <div className="flex flex-col items-center gap-2.5 pt-2 pb-1 text-center">
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
                <button
                  type="button"
                  onClick={() => {
                    const scroller = document.getElementById("app-scroll");
                    if (scroller) {
                      scroller.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
                    } else {
                      window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
                    }
                  }}
                  className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-neutral-700 shadow-2xs transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900 active:scale-95"
                >
                  <ArrowUp size={14} />
                  <span>Back to top</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
