"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { usePlayer } from "./context/PlayerContext";
import { PageSkeleton } from "./components/Skeleton";
import { Disc, Music, Sparkles, Wand2, ArrowRight, Play, Clock, Pause } from "lucide-react";

const verses = [
  { ref: "Psalm 150:6", text: "Let everything that has breath praise the Lord." },
  { ref: "Psalm 95:1", text: "Oh come, let us sing to the Lord; let us make a joyful noise to the rock of our salvation!" },
  { ref: "Psalm 100:1-2", text: "Make a joyful noise to the Lord, all the earth! Serve the Lord with gladness!" },
  { ref: "Colossians 3:16", text: "Let the word of Christ dwell in you richly, singing psalms and hymns and spiritual songs." },
  { ref: "Psalm 96:1", text: "Oh sing to the Lord a new song; sing to the Lord, all the earth!" },
  { ref: "Ephesians 5:19", text: "Addressing one another in psalms and hymns and spiritual songs, singing and making melody to the Lord." },
];

const timeWindowDays = 14;

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
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
      className={`group relative flex w-[76vw] flex-shrink-0 snap-start items-center gap-3.5 rounded-2xl p-3.5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md md:w-[290px] ${
        isActive
          ? "bg-accent/8 border border-accent/20 shadow-sm"
          : "bg-neutral-50/60 hover:bg-neutral-100/80 border border-transparent"
      }`}
    >
      {isActive && (
        <span className="absolute top-2.5 right-2.5 flex h-1.5 w-1.5 rounded-full bg-accent">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
        </span>
      )}
      <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl shadow-sm transition-colors ${
        isActive ? "bg-accent text-white" : "bg-neutral-900/5 text-neutral-800 group-hover:bg-accent group-hover:text-white"
      }`}>
        {isActive ? (
          <div className="waveform text-white"><span /><span /><span /><span /></div>
        ) : (
          <Music size={18} />
        )}
      </div>
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
      className="group relative flex w-[140px] flex-shrink-0 snap-start flex-col items-center gap-2.5 rounded-xl border border-neutral-100 bg-white p-3.5 text-center transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md md:w-[170px] md:gap-3 md:rounded-2xl md:p-4"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500 transition-colors group-hover:bg-accent group-hover:text-white md:h-14 md:w-14 md:rounded-2xl">
        <Music size={18} className="md:size-[22px]" />
      </div>
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

const SectionBlock = ({ id, title, subtitle, icon: Icon, items, onPlay, cta, vertical, activeSongId }) => {
  const Card = vertical ? FeaturedCard : SongRailCard;
  return (
    <section id={id} className="scroll-mt-24 py-2">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Icon size={15} className="text-neutral-400" />
            <h2 className="text-sm font-bold tracking-tight text-neutral-900 md:text-base">{title}</h2>
          </div>
          <p className="mt-0.5 ml-7 text-[11px] text-neutral-400 md:text-xs">{subtitle}</p>
        </div>
        {cta && (
          <Link
            href={cta.href}
            className="group flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-450 transition hover:text-neutral-900"
          >
            {cta.label}
            <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>

      <div className="flex snap-x snap-mandatory gap-3.5 overflow-x-auto pb-2 no-scrollbar [mask-image:linear-gradient(to_right,black_calc(100%-32px),transparent_100%)]">
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

  useEffect(() => {
    if (activeSong) return;
    const interval = setInterval(() => {
      setVerseIndex((prev) => (prev + 1) % verses.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [activeSong]);

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

  const sortedSongs = useMemo(() => {
    return [...(allSongs || [])].sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
    );
  }, [allSongs]);

  const newestSongs = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
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
    return shuffle(mixed).slice(0, 6);
  }, [sortedSongs]);

  const featuredIds = useMemo(
    () => new Set(featuredSongs.map((song) => song.id)),
    [featuredSongs]
  );
  const newestIds = useMemo(() => new Set(newestSongs.map((song) => song.id)), [newestSongs]);

  const recommendedSongs = useMemo(() => {
    const scoreSong = (song) => {
      let score = 0;
      const category = (song.category || "").toLowerCase();
      const duration = (song.duration || "").toLowerCase();
      const createdAt = new Date(song.created_at || 0).getTime();
      const ageDays = Number.isFinite(createdAt)
        ? (Date.now() - createdAt) / (24 * 60 * 60 * 1000)
        : 999;

      if (category === "praise") score += 4;
      if (duration === "long") score += 1.5;
      if (ageDays <= 30) score += 3;
      else if (ageDays <= 90) score += 1;
      return score;
    };

    return shuffle(
      [...sortedSongs]
        .filter((song) => !featuredIds.has(song.id) && !newestIds.has(song.id))
        .sort((a, b) => scoreSong(b) - scoreSong(a))
    ).slice(0, 6);
  }, [sortedSongs, featuredIds, newestIds]);

  const stats = {
    total: allSongs?.length || 0,
    new: newestSongs.length,
    featured: featuredSongs.length,
  };

  return (
    <main className="min-h-[90vh] bg-transparent px-3 pb-36 pt-2 md:px-8 md:pt-6">
      <div className="mx-auto max-w-5xl">
        
        {/* Typographic Hero Banner */}
        <section className="mb-6 md:mb-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-6 w-1 rounded-full bg-accent" />
              <h1 className="text-xl font-bold tracking-tight text-neutral-900 md:text-2xl uppercase">
                Worship in Song
              </h1>
            </div>
            <div className="hidden shrink-0 md:flex items-center gap-2 rounded-full border border-neutral-100 bg-neutral-50/60 px-3.5 py-1.5 text-[11px] font-medium text-neutral-400">
              <span>{stats.total} tracks</span>
              <span className="h-1 w-1 rounded-full bg-neutral-300" />
              <span className="text-accent font-semibold">{stats.new} new</span>
            </div>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-400 max-w-xl">
            A curated collection of worship and praise songs.
          </p>
          
          <div className="mt-4 md:hidden inline-flex items-center gap-2 rounded-full border border-neutral-100 bg-neutral-50/60 px-3.5 py-1.5 text-[11px] font-medium text-neutral-400">
            <span>{stats.total} tracks</span>
            <span className="h-1 w-1 rounded-full bg-neutral-300" />
            <span className="text-accent font-semibold">{stats.new} new</span>
          </div>
        </section>

        {/* Banner */}
        <div className="mb-8 overflow-hidden rounded-2xl border px-5 py-4 md:rounded-3xl md:px-8 md:py-6 transition-all duration-500 bg-gradient-to-r from-accent/5 via-accent/10 to-transparent border-accent/10">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent md:h-12 md:w-12">
              {activeSong ? (
                <div className="waveform text-accent"><span /><span /><span /><span /></div>
              ) : (
                <Music size={18} className="md:size-[22px]" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              {activeSong ? (
                <>
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-accent/70 mb-0.5">Now Playing</p>
                  <p className="truncate text-sm font-semibold tracking-tight text-neutral-900 md:text-base">
                    {activeSong.title}
                  </p>
                  <p className="truncate mt-0.5 text-xs leading-relaxed text-neutral-500">
                    {activeSong.author}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold tracking-tight text-neutral-900 md:text-base">
                    {verses[verseIndex].ref}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-neutral-500 md:text-sm transition-opacity duration-500">
                    {verses[verseIndex].text}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {isLoading ? (
          <PageSkeleton letterGroups={3} />
        ) : (
          <div className="flex flex-col gap-8 md:gap-10">
            <SectionBlock
              id="featured-songs"
              title="Featured"
              subtitle="Standout songs curated for you"
              icon={Wand2}
              items={featuredSongs}
              onPlay={(song) => setActiveSong(song, featuredSongs)}
              activeSongId={activeSong?.id}
              cta={{ href: "/songs", label: "View all" }}
              vertical
            />

            <SectionBlock
              id="newest-songs"
              title="New Additions"
              subtitle="Added in the past month"
              icon={Music}
              items={newestSongs}
              onPlay={(song) => setActiveSong(song, newestSongs)}
              activeSongId={activeSong?.id}
              cta={{ href: "/songs", label: "View all" }}
              vertical
            />

            {recentlyPlayed.length > 0 && (
              <SectionBlock
                id="recently-played"
                title="Recently Played"
                subtitle="Your listening history"
                icon={Clock}
                items={recentlyPlayed}
                onPlay={(song) => setActiveSong(song, recentlyPlayed)}
                activeSongId={activeSong?.id}
              />
            )}
            
            <SectionBlock
              id="recommended-songs"
              title="Recommended"
              subtitle="Suggestions based on your categories"
              icon={Sparkles}
              items={recommendedSongs}
              onPlay={(song) => setActiveSong(song, recommendedSongs)}
              activeSongId={activeSong?.id}
              cta={{ href: "/songs", label: "View all" }}
            />

            {sortedSongs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Disc className="mb-4 text-neutral-300" size={32} />
                <p className="text-sm font-semibold text-neutral-900">
                  No songs found
                </p>
                <p className="mt-1 max-w-sm text-xs text-neutral-450">
                  When tracks are uploaded, they’ll appear here in the library sections.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
