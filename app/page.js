"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { usePlayer } from "./context/PlayerContext";
import { useAuth } from "./context/AuthContext";
import { PageSkeleton } from "./components/Skeleton";
import SongAvatar, { initialLetter, hashStr } from "./components/SongAvatar";
import { Disc, Music, ArrowRight, Play, Upload, Sparkles, Star, Clock, ListMusic, ChevronDown, ChevronUp, Copy, Check, Shuffle } from "lucide-react";
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
      className={`group relative flex w-[76vw] flex-shrink-0 snap-start items-center gap-3.5 rounded-2xl p-3.5 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-md md:w-[290px] ${
        isActive
          ? "bg-accent/[0.04] border border-accent/10 shadow-sm"
          : "bg-white border border-neutral-200 shadow-sm hover:border-neutral-300"
      }`}
    >
      {isActive && (
        <span className="absolute top-2.5 right-2.5 flex h-1.5 w-1.5 rounded-full bg-accent">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-40" />
        </span>
      )}
      <SongAvatar title={song.title} size="lg" variant="mono" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className={`truncate text-sm font-semibold tracking-tight ${
            isActive ? "text-accent" : "text-neutral-900"
          }`}>
            {song.title}
          </p>
          {isNew && !isActive && (
            <span className="rounded bg-accent/[0.06] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-accent">
              New
            </span>
          )}
        </div>
        <p className="truncate text-[11px] font-medium text-neutral-400 mt-0.5">
          {song.author}
        </p>
      </div>
      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
        isActive ? "bg-accent text-white" : "bg-neutral-100 text-neutral-600 group-hover:bg-accent group-hover:text-white"
      }`}>
        <Play size={14} fill="currentColor" className="ml-0.5" />
      </div>
    </button>
  );
};

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
      className={`group relative flex w-[140px] flex-shrink-0 snap-start flex-col items-center gap-2.5 rounded-xl border p-3.5 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-md md:w-[170px] md:gap-3 md:rounded-2xl md:p-4 ${
        isActive
          ? "bg-accent/[0.04] border-accent/10 shadow-sm"
          : "border-neutral-200 bg-white shadow-sm hover:border-neutral-300"
      }`}
    >
      {isActive && (
        <span className="absolute top-2.5 right-2.5 flex h-1.5 w-1.5 rounded-full bg-accent">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-40" />
        </span>
      )}
      <SongAvatar title={song.title} size="lg" variant="mono" />
      <div className="w-full min-w-0">
        <div className="flex items-center justify-center gap-1">
          <p className={`truncate text-xs font-semibold tracking-tight md:text-sm ${
            isActive ? "text-accent" : "text-neutral-900"
          }`}>
            {song.title}
          </p>
          {isNew && !isActive && (
            <span className="rounded bg-accent/[0.06] px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider text-accent md:text-[8px]">
              New
            </span>
          )}
        </div>
        <p className="truncate text-[10px] font-medium text-neutral-400 mt-0.5 md:text-[11px]">
          {song.author}
        </p>
      </div>
      <div className={`flex h-7 w-7 items-center justify-center rounded-full transition-all duration-300 md:h-8 md:w-8 ${
        isActive ? "bg-accent text-white" : "bg-neutral-100 text-neutral-500 group-hover:bg-accent group-hover:text-white"
      }`}>
        <Play size={11} fill="currentColor" className="ml-0.5 md:size-[13px]" />
      </div>
    </button>
  );
};

const SpotifyCard = ({ song, onClick, isActive }) => {
  return (
    <button
      type="button"
      onClick={() => onClick(song)}
      onMouseEnter={() => prefetchSongAudio(song)}
      className={`group relative flex w-[170px] flex-shrink-0 snap-start flex-col rounded-2xl border p-3 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${
        isActive
          ? "bg-accent/[0.04] border-accent/10 shadow-sm"
          : "bg-white border-neutral-200 shadow-sm hover:border-neutral-300"
      }`}
    >
      {isActive && (
        <span className="absolute top-2 right-2 flex h-1.5 w-1.5 rounded-full bg-accent">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-40" />
        </span>
      )}
      <div className="relative mb-3 overflow-hidden rounded-xl">
        <div className="flex h-24 w-full items-center justify-center bg-neutral-100 md:h-28">
          <Music size={24} className="text-neutral-400" />
        </div>
        <div className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white shadow-md opacity-0 translate-y-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
          <Play size={13} fill="currentColor" className="ml-0.5" />
        </div>
      </div>
      <p className={`truncate text-sm font-semibold tracking-tight ${isActive ? "text-accent" : "text-neutral-900"}`}>{song.title}</p>
      <p className="truncate text-xs text-neutral-400 mt-0.5">{song.author}</p>
    </button>
  );
};

const RecommendationCard = ({ song, onClick, isActive }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => prefetchSongAudio(song)}
      className={`group flex w-full items-center gap-3.5 rounded-2xl p-3.5 text-left transition-all duration-300 hover:bg-white hover:shadow-sm hover:border hover:border-neutral-200 border border-transparent ${
        isActive
          ? "bg-accent/[0.04] border border-accent/10"
          : "bg-white border-neutral-200"
      }`}
    >
      <SongAvatar title={song.title} size="md" variant="mono" />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-semibold tracking-tight ${
          isActive ? "text-accent" : "text-neutral-900"
        }`}>
          {song.title}
        </p>
        <p className="truncate text-[11px] font-medium text-neutral-400 mt-0.5">
          {song.author}
        </p>
      </div>
      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
        isActive
          ? "bg-accent text-white"
          : "bg-neutral-100 text-neutral-600 group-hover:bg-accent group-hover:text-white"
      }`}>
        <Play size={14} fill="currentColor" className="ml-0.5" />
      </div>
    </button>
  );
};

const SectionBlock = ({ id, title, icon: Icon, items, onPlay, onPlayAll, cta, cardType, activeSongId, children }) => {
  const Card = cardType === "spotify" ? SpotifyCard : cardType === "featured" ? FeaturedCard : SongRailCard;
  return (
    <section id={id} className="scroll-mt-24 py-1">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          {Icon && <Icon size={14} className="text-accent" />}
          <h2 className="text-sm font-bold tracking-tight text-neutral-900 md:text-base">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {onPlayAll && items.length > 0 && (
            <button
              type="button"
              onClick={() => onPlayAll(items[0])}
              className="flex items-center gap-1 rounded-full bg-accent/8 px-2.5 py-1 text-[10px] font-bold text-accent transition hover:bg-accent/15"
            >
              <Play size={10} fill="currentColor" />
              Play
            </button>
          )}
          {cta && (
            <Link
              href={cta.href}
              className="group flex items-center gap-1 text-[11px] font-medium text-neutral-400 transition hover:text-neutral-900"
            >
              <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      </div>

      {children || (
        <div className="flex snap-x snap-mandatory gap-3.5 overflow-x-auto pb-3 scrollbar-thin [mask-image:linear-gradient(to_right,black_calc(100%-40px),transparent_100%)]">
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
            <div className="w-full rounded-2xl border border-dashed border-neutral-100 bg-neutral-50/20 py-8 text-center text-xs text-neutral-400">
              No songs available in this section yet.
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default function Home() {
  const { allSongs, setAllSongs, setActiveSong, isLoading, setIsLoading, recentlyPlayed, activeSong, playingSource } =
    usePlayer();
  const { user, profile } = useAuth();
  const [loadError, setLoadError] = useState(false);
  const [verseIndex, setVerseIndex] = useState(0);
  const [showAllRecs, setShowAllRecs] = useState(false);
  const [verseCopied, setVerseCopied] = useState(false);

  useEffect(() => {
    if (activeSong) return;
    const interval = setInterval(() => {
      setVerseIndex((prev) => (prev + 1) % verses.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [activeSong]);

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
    return seededShuffle(sortedSongs, `recommend-${songIdsKey}-${sessionSeed}`).slice(0, 30);
  }, [songIdsKey, sessionSeed, sortedSongs]);

  const visibleRecs = showAllRecs ? recommendedSongs : recommendedSongs.slice(0, 8);

  const stats = {
    total: allSongs?.length || 0,
    new: newestSongs.length,
  };

  const playingSection = playingSource || "library";

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

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

  return (
    <main className="min-h-[90vh] bg-neutral-50/60 px-3 pb-8 pt-2 md:px-8 md:pt-6">
      <ScrollProgress />
      <div className="mx-auto max-w-5xl">
        {/* Mobile brand — homepage only */}
        <div className="md:hidden flex items-center px-1 pb-3 pt-1">
          <h2 className="text-[18px] font-bold tracking-tight text-neutral-900 leading-none">Lumbo</h2>
        </div>

        {/* Hero */}
        <section className="relative mb-6 overflow-hidden rounded-2xl border-l-[3px] border-l-accent border border-neutral-200 bg-white px-5 py-7 md:mb-8 md:rounded-3xl md:px-8 md:py-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent/[0.03] via-transparent to-transparent" />
          <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "radial-gradient(circle, #0f172a 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
          <div className="relative md:flex md:items-start md:justify-between md:gap-8">
            {/* Left column — title & stats */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl font-bold tracking-tight text-neutral-900 md:text-2xl">
                  <span className="bg-gradient-to-br from-accent to-neutral-700 bg-clip-text text-transparent">Worship in Song</span>
                </h1>
              </div>
              {userName ? (
                <p className="text-sm text-neutral-500 mb-3 md:mb-4">
                  {getGreeting()}, <span className="font-semibold text-neutral-700">{userName}</span>
                </p>
              ) : (
                <p className="text-sm text-neutral-400 mb-3 md:mb-4">
                  {getGreeting()}
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap mb-4 md:mb-5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-medium text-neutral-500">
                  <span className="font-bold text-neutral-700">{stats.total}</span> tracks
                </span>
                {stats.new > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/5 px-2.5 py-1 text-[11px] font-medium text-accent">
                    <span className="font-bold">{stats.new}</span> new
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-medium text-neutral-500">
                  <span className="font-bold text-neutral-700">{new Set(sortedSongs.map(s => s.author)).size}</span> artists
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={shuffleAll}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-accent/90"
                >
                  <Shuffle size={12} />
                  Shuffle All
                </button>
                {recentlyPlayed.length > 0 && (
                  <a
                    href="#recently-played"
                    className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50"
                  >
                    <Clock size={12} />
                    Recent
                  </a>
                )}
              </div>
            </div>

            {/* Right column — verse / now playing */}
            <div className="mt-4 md:mt-0 md:max-w-[320px] w-full">
              <div className="flex items-center gap-3 rounded-xl bg-neutral-50 px-4 py-3 border border-neutral-100">
                {activeSong ? (
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <SongAvatar title={activeSong.title} size="sm" variant="mono" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold tracking-tight text-neutral-900">{activeSong.title}</p>
                      <p className="truncate text-[10px] text-neutral-400">Playing from {playingSection}</p>
                    </div>
                    <div className="waveform text-accent flex h-6 items-center"><span /><span /><span /><span /></div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={copyVerse}
                    className="flex items-center gap-3 flex-1 text-left group"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/[0.06] border border-accent/10">
                      <Music size={14} className="text-accent" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs leading-relaxed text-neutral-600 italic transition-opacity duration-500 line-clamp-2">
                        {verses[verseIndex].text}
                      </p>
                      <p className="text-[9px] text-neutral-400 mt-1 font-medium">
                        {verses[verseIndex].ref}
                      </p>
                    </div>
                    <div className="shrink-0 text-neutral-300 group-hover:text-neutral-500 transition">
                      {verseCopied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                    </div>
                  </button>
                )}
              </div>
              {!activeSong && (
                <p className="text-[9px] text-neutral-300 mt-1.5 px-1 italic">Tap verse to copy</p>
              )}
            </div>
          </div>
        </section>

        {isLoading ? (
          <PageSkeleton letterGroups={3} />
        ) : (
          <div className="flex flex-col gap-5 md:gap-8">
            {loadError && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Songs could not be loaded. Check your connection or Supabase configuration and try again.
              </div>
            )}

            {spotifySong && (
              <LazySection>
                <section className="scroll-mt-24 py-1">
                  <div className="mb-4 flex items-center gap-2.5">
                    <Star size={14} className="text-accent" />
                    <h2 className="text-sm font-bold tracking-tight text-neutral-900 md:text-base">Spotlight</h2>
                  </div>
                  <div
                    className="relative overflow-hidden rounded-2xl border border-accent/10 bg-accent md:rounded-3xl"
                    onMouseEnter={() => prefetchSongAudio(spotifySong)}
                  >
                    <div className="relative flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between md:gap-4 md:p-6">
                      <div className="flex items-center gap-3.5 md:gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/10 text-xl font-bold text-white md:h-16 md:w-16 md:rounded-2xl md:text-2xl">
                          {initialLetter(spotifySong.title)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60 mb-1">Featured Track</p>
                          <p className="truncate text-base font-bold text-white md:text-lg">{spotifySong.title}</p>
                          <p className="truncate text-xs text-white/70 mt-0.5">{spotifySong.author}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveSong(spotifySong, sortedSongs)}
                        className="flex items-center gap-2 self-start rounded-full bg-white px-4 py-2 text-xs font-bold text-accent transition hover:bg-white/90 md:self-auto md:px-5 md:py-2.5 md:text-sm"
                      >
                        <Play size={13} fill="currentColor" />
                        Play
                      </button>
                    </div>
                  </div>
                </section>
              </LazySection>
            )}

            <LazySection delay={50}>
              <SectionBlock
                id="featured-songs"
                title="Featured"
                icon={Star}
                items={featuredSongs}
                onPlay={(song) => setActiveSong(song, featuredSongs)}
                onPlayAll={(song) => setActiveSong(song, featuredSongs)}
                activeSongId={activeSong?.id}
                cta={{ href: "/songs" }}
                cardType="spotify"
              />
            </LazySection>

            <LazySection delay={100}>
              <SectionBlock
                id="newest-songs"
                title="New Additions"
                icon={Sparkles}
                items={newestSongs}
                onPlay={(song) => setActiveSong(song, newestSongs)}
                onPlayAll={(song) => setActiveSong(song, newestSongs)}
                activeSongId={activeSong?.id}
                cta={{ href: "/songs" }}
                cardType="featured"
              />
            </LazySection>

            {recentlyPlayed.length > 0 && (
              <LazySection delay={150}>
                <SectionBlock
                  id="recently-played"
                  title="Recently Played"
                  icon={Clock}
                  items={recentlyPlayed}
                  onPlay={(song) => setActiveSong(song, recentlyPlayed)}
                  activeSongId={activeSong?.id}
                />
              </LazySection>
            )}

            {recommendedSongs.length > 0 && (
              <LazySection delay={200}>
                <section id="recommended" className="scroll-mt-24 py-1">
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <ListMusic size={14} className="text-accent" />
                      <h2 className="text-sm font-bold tracking-tight text-neutral-900 md:text-base">Recommendations</h2>
                    </div>
                    {recommendedSongs.length > 8 && (
                      <button
                        type="button"
                        onClick={() => setShowAllRecs(!showAllRecs)}
                        className="flex items-center gap-1 text-[11px] font-medium text-neutral-400 transition hover:text-neutral-900"
                      >
                        {showAllRecs ? "Show less" : `Show all (${recommendedSongs.length})`}
                        {showAllRecs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-y-1">
                    {visibleRecs.map((song) => (
                      <RecommendationCard
                        key={song.id}
                        song={song}
                        isActive={song.id === activeSong?.id}
                        onClick={() => setActiveSong(song, recommendedSongs)}
                      />
                    ))}
                  </div>
                </section>
              </LazySection>
            )}

            {sortedSongs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/[0.06] border border-accent/10">
                  <Sparkles className="text-accent" size={28} />
                </div>
                <p className="text-base font-bold tracking-tight text-neutral-900">
                  Your library is empty
                </p>
                <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-neutral-400">
                  Upload your first worship song and start building your collection. Songs will appear here automatically.
                </p>
                <Link
                  href="/admin"
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-accent/90"
                >
                  <Upload size={14} />
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
