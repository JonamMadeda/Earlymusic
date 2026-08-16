"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { usePlayer } from "./context/PlayerContext";
import { PageSkeleton } from "./components/Skeleton";
import SongAvatar, { pastelGradient, initialLetter, hashStr, avoidGreen } from "./components/SongAvatar";
import { Disc, Music, ArrowRight, Play, Upload, Sparkles } from "lucide-react";
import LazySection from "./components/LazySection";
import { prefetchSongAudio } from "@/lib/prefetchAudio";


const verses = [
  { ref: "Psalm 150:6", text: "Let everything that has breath praise the Lord." },
  { ref: "Psalm 95:1", text: "Oh come, let us sing to the Lord; let us make a joyful noise to the rock of our salvation!" },
  { ref: "Psalm 100:1-2", text: "Make a joyful noise to the Lord, all the earth! Serve the Lord with gladness!" },
  { ref: "Colossians 3:16", text: "Let the word of Christ dwell in you richly, singing psalms and hymns and spiritual songs." },
  { ref: "Psalm 96:1", text: "Oh sing to the Lord a new song; sing to the Lord, all the earth!" },
  { ref: "Ephesians 5:19", text: "Addressing one another in psalms and hymns and spiritual songs, singing and making melody to the Lord." },
];

const timeWindowDays = 30;

const cyclingGradient = (seed) => {
  const h1 = avoidGreen(hashStr(seed || "s") % 360);
  const h2 = avoidGreen((h1 + 40) % 360);
  const h3 = avoidGreen((h1 + 80) % 360);
  const h4 = avoidGreen((h1 + 120) % 360);
  return `linear-gradient(135deg, hsl(${h1},70%,62%), hsl(${h2},65%,58%), hsl(${h3},60%,64%), hsl(${h4},68%,60%))`;
};

const mulberry32 = (seed) => {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Deterministic shuffle — identical content always yields the same order,
// so random sections don't visibly reshuffle when the cache is replaced by
// the same database response.
const seededShuffle = (arr, seedStr) => {
  const rng = mulberry32(hashStr(seedStr || "s"));
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
      className={`group relative flex w-[76vw] flex-shrink-0 snap-start items-center gap-3.5 rounded-2xl p-3.5 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-lg md:w-[290px] ${
        isActive
          ? "bg-accent/8 border border-accent/20 shadow-md shadow-accent/5"
          : "bg-white border border-neutral-100 shadow-sm hover:shadow-md hover:border-neutral-200"
      }`}
    >
      {isActive && (
        <span className="absolute top-2.5 right-2.5 flex h-1.5 w-1.5 rounded-full bg-accent">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
        </span>
      )}
      <SongAvatar title={song.title} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className={`truncate text-sm font-semibold tracking-tight ${
            isActive ? "text-accent" : "text-neutral-900"
          }`}>
            {song.title}
          </p>
          {isNew && !isActive && (
            <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-accent">
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

const FeaturedCard = ({ song, onClick }) => {
  const isNew =
    song.created_at &&
    Date.now() - new Date(song.created_at).getTime() <
      timeWindowDays * 24 * 60 * 60 * 1000;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => prefetchSongAudio(song)}
      className="group relative flex w-[140px] flex-shrink-0 snap-start flex-col items-center gap-2.5 rounded-xl border border-neutral-100 bg-white p-3.5 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg md:w-[170px] md:gap-3 md:rounded-2xl md:p-4 shadow-sm"
    >
      <SongAvatar title={song.title} size="lg" />
      <div className="w-full min-w-0">
        <div className="flex items-center justify-center gap-1">
          <p className="truncate text-xs font-semibold tracking-tight text-neutral-900 md:text-sm">
            {song.title}
          </p>
          {isNew && (
            <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider text-accent md:text-[8px]">
              New
            </span>
          )}
        </div>
        <p className="truncate text-[10px] font-medium text-neutral-400 mt-0.5 md:text-[11px]">
          {song.author}
        </p>
      </div>
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition-all duration-300 group-hover:bg-accent group-hover:text-white md:h-8 md:w-8">
        <Play size={11} fill="currentColor" className="ml-0.5 md:size-[13px]" />
      </div>
    </button>
  );
};

const SpotifyCard = ({ song, onClick }) => {
  return (
    <button
      type="button"
      onClick={() => onClick(song)}
      onMouseEnter={() => prefetchSongAudio(song)}
      className="group relative flex w-[170px] flex-shrink-0 snap-start flex-col rounded-2xl bg-white border border-neutral-100 p-3 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-lg shadow-sm"
    >
      <div className="relative mb-3 overflow-hidden rounded-xl">
        <div
          className="flex h-24 w-full items-center justify-center md:h-28"
          style={{ background: pastelGradient(song.title || "default") }}
        >
          <Music size={24} className="text-white/40" />
        </div>
        <div className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white shadow-lg opacity-0 translate-y-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
          <Play size={13} fill="currentColor" className="ml-0.5" />
        </div>
      </div>
      <p className="truncate text-sm font-semibold tracking-tight text-neutral-900">{song.title}</p>
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
      className={`group flex w-full items-center gap-3.5 rounded-2xl p-3.5 text-left transition-all duration-300 hover:bg-neutral-100/80 hover:shadow-sm ${
        isActive
          ? "bg-accent/8 border border-accent/20"
          : "bg-transparent"
      }`}
    >
      <SongAvatar title={song.title} size="md" />
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

const SectionBlock = ({ id, title, items, onPlay, cta, cardType, activeSongId }) => {
  const Card = cardType === "spotify" ? SpotifyCard : cardType === "featured" ? FeaturedCard : SongRailCard;
  return (
    <section id={id} className="scroll-mt-24 py-2">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-4 w-0.5 rounded-full bg-accent/50" />
          <h2 className="text-sm font-bold tracking-tight text-neutral-900 md:text-base">{title}</h2>
        </div>
        {cta && (
          <Link
            href={cta.href}
            className="group flex items-center gap-1 text-[11px] font-medium text-neutral-400 transition hover:text-neutral-900"
          >
            <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>

      <div className="flex snap-x snap-mandatory gap-3.5 overflow-x-auto pb-4 scrollbar-thin md:pb-3 [mask-image:linear-gradient(to_right,black_calc(100%-32px),transparent_100%)] md:[mask-image:none]">
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
    </section>
  );
};

export default function Home() {
  const { allSongs, setAllSongs, setActiveSong, isLoading, setIsLoading, recentlyPlayed, activeSong } =
    usePlayer();
  const [verseIndex, setVerseIndex] = useState(0);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (activeSong) return;
    const interval = setInterval(() => {
      setVerseIndex((prev) => (prev + 1) % verses.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [activeSong]);

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

  const sortedSongs = useMemo(() => {
    return [...(allSongs || [])].sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
    );
  }, [allSongs]);

  // Stable identity so random sections don't reshuffle when the cached list is
  // replaced by an identical response from the database.
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
    return seededShuffle(mixed, `featured-${songIdsKey}`).slice(0, 15);
  }, [songIdsKey, sortedSongs]);

  const spotifySong = useMemo(() => {
    if (sortedSongs.length === 0) return null;
    const rng = mulberry32(hashStr(`spotlight-${songIdsKey}`));
    return sortedSongs[Math.floor(rng() * Math.min(sortedSongs.length, 5))];
  }, [songIdsKey, sortedSongs]);

  const recommendedSongs = useMemo(() => {
    if (sortedSongs.length === 0) return [];
    return seededShuffle(sortedSongs, `recommend-${songIdsKey}`).slice(0, 30);
  }, [songIdsKey, sortedSongs]);

  const stats = {
    total: allSongs?.length || 0,
    new: newestSongs.length,
  };

  return (
    <main className="min-h-[90vh] bg-transparent px-3 pb-8 pt-2 md:px-8 md:pt-6">
      <div className="mx-auto max-w-5xl">

        {/* Hero */}
        <section className="relative mb-8 overflow-hidden rounded-2xl px-5 py-6 md:rounded-3xl md:px-8 md:py-8">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-accent/5 to-transparent" />
          <div className="absolute top-0 right-0 h-64 w-64 translate-x-1/3 -translate-y-1/3 rounded-full bg-accent/5 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-neutral-900 md:text-2xl">
                Worship in Song
              </h1>
              <span className="hidden md:inline-flex items-center gap-2 rounded-full border border-neutral-200/60 bg-white/60 px-3 py-1 text-[11px] font-medium text-neutral-400 backdrop-blur-sm">
                <span>{stats.total}</span>
                <span className="h-1 w-1 rounded-full bg-neutral-300" />
                <span className="text-accent">{stats.new} new</span>
              </span>
            </div>
            <div className="mt-3 md:hidden inline-flex items-center gap-2 rounded-full border border-neutral-200/60 bg-white/60 px-3 py-1 text-[11px] font-medium text-neutral-400 backdrop-blur-sm">
              <span>{stats.total} tracks</span>
              <span className="h-1 w-1 rounded-full bg-neutral-300" />
              <span className="text-accent">{stats.new} new</span>
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/40 px-4 py-3 backdrop-blur-sm border border-white/60">
              {activeSong ? (
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <SongAvatar title={activeSong.title} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold tracking-tight text-neutral-900">{activeSong.title}</p>
                    <p className="truncate text-xs text-neutral-500">{activeSong.author}</p>
                  </div>
                  <div className="waveform text-accent flex h-6 items-center"><span /><span /><span /><span /></div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Music size={14} className="shrink-0 text-neutral-400" />
                  <p className="text-xs leading-relaxed text-neutral-500 italic transition-opacity duration-500">
                    {verses[verseIndex].text}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {isLoading ? (
          <PageSkeleton letterGroups={3} />
        ) : (
          <div className="flex flex-col gap-5 md:gap-7">
            {loadError && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Songs could not be loaded. Check your connection or Supabase configuration and try again.
              </div>
            )}

            {spotifySong && (
              <LazySection>
                <section className="scroll-mt-24 py-2">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="h-4 w-0.5 rounded-full bg-accent/50" />
                    <h2 className="text-sm font-bold tracking-tight text-neutral-900 md:text-base">Spotlight</h2>
                  </div>
                  <div
                    className="relative overflow-hidden rounded-2xl md:rounded-3xl spotlight-gradient"
                    style={{ background: cyclingGradient(spotifySong.title || "default") }}
                    onMouseEnter={() => prefetchSongAudio(spotifySong)}
                  >
                    <div className="relative flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-8">
                      <div className="flex items-center gap-4">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl font-bold text-white shadow-inner md:h-20 md:w-20 md:text-3xl backdrop-blur-sm">
                          {initialLetter(spotifySong.title)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Featured Track</p>
                          <p className="truncate text-lg font-bold text-white md:text-xl">{spotifySong.title}</p>
                          <p className="truncate text-sm text-white/70">{spotifySong.author}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveSong(spotifySong, sortedSongs)}
                        className="flex items-center gap-2 self-start rounded-full bg-white/20 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/30 md:self-auto"
                      >
                        <Play size={14} fill="currentColor" />
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
                items={featuredSongs}
                onPlay={(song) => setActiveSong(song, featuredSongs)}
                activeSongId={activeSong?.id}
                cta={{ href: "/songs" }}
                cardType="spotify"
              />
            </LazySection>

            <LazySection delay={100}>
              <SectionBlock
                id="newest-songs"
                title="New Additions"
                items={newestSongs}
                onPlay={(song) => setActiveSong(song, newestSongs)}
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
                  items={recentlyPlayed}
                  onPlay={(song) => setActiveSong(song, recentlyPlayed)}
                  activeSongId={activeSong?.id}
                />
              </LazySection>
            )}

            {recommendedSongs.length > 0 && (
              <LazySection delay={200}>
                <section id="recommended" className="scroll-mt-24 py-2">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="h-4 w-0.5 rounded-full bg-accent/50" />
                    <h2 className="text-sm font-bold tracking-tight text-neutral-900 md:text-base">Recommendation</h2>
                  </div>
                  <div className="flex flex-col gap-y-1">
                    {recommendedSongs.map((song) => (
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
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/8">
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
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-accent/20 transition hover:bg-accent/90 hover:shadow-lg hover:shadow-accent/25"
                >
                  <Upload size={14} />
                  Upload a Song
                </Link>
              </div>
            )}

            {sortedSongs.length > 0 && (
              <div className="flex flex-col items-center py-3 text-center">
                <div className="h-px w-12 bg-neutral-200/60 mb-3" />
                <p className="text-xs text-neutral-400/70 italic leading-relaxed max-w-xs mb-3">
                  that&apos;s all for now — refresh to discover new recommendations
                </p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="rounded-full border border-neutral-200/70 bg-white/50 px-4 py-2 text-[11px] font-semibold text-neutral-400 backdrop-blur-sm transition hover:border-neutral-300 hover:bg-white hover:text-neutral-700"
                >
                  Refresh
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
