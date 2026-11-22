"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  LogIn,
  Moon,
  Pause,
  Play,
  Quote,
  Shuffle,
  Star,
  Sun,
  Sunrise,
} from "lucide-react";
import { usePlayer } from "../context/PlayerContext";
import { useAuth } from "../context/AuthContext";
import { usePlaybackStatus } from "../context/playbackStatus";
import { useNotificationFeed } from "@/lib/notificationFeed";
import { normalizeNotificationId, normalizeNotificationKind } from "@/lib/notifications";
import { getWorshipSeason } from "@/lib/worshipSeason";
import { formatTime } from "@/lib/timeFormat";
import { prefetchSongAudio } from "@/lib/prefetchAudio";
import { initialLetter } from "./SongAvatar";

const verses = [
  { ref: "Psalm 150:6", text: "Let everything that has breath praise the Lord." },
  { ref: "Psalm 95:1", text: "Oh come, let us sing to the Lord; let us make a joyful noise to the rock of our salvation!" },
  { ref: "Psalm 100:1-2", text: "Make a joyful noise to the Lord, all the earth! Serve the Lord with gladness!" },
  { ref: "Colossians 3:16", text: "Let the word of Christ dwell in you richly, singing psalms and hymns and spiritual songs." },
  { ref: "Psalm 96:1", text: "Oh sing to the Lord a new song; sing to the Lord, all the earth!" },
  { ref: "Ephesians 5:19", text: "Addressing one another in psalms and hymns and spiritual songs, singing and making melody to the Lord." },
];

const greetingFor = (hour) => {
  if (hour < 12) return { text: "Good morning", icon: Sunrise };
  if (hour < 18) return { text: "Good afternoon", icon: Sun };
  return { text: "Good evening", icon: Moon };
};

const addedLabel = (dateStr, now) => {
  const created = Date.parse(dateStr);
  if (!Number.isFinite(created) || now == null) return "Just added";
  const diff = now - created;
  if (diff < 0) return "Just added";
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "Added today";
  if (days === 1) return "Added yesterday";
  if (days < 7) return `Added ${days} days ago`;
  return "Recently added";
};

// These are plain render helpers, not components: the hero is a single
// surface, and calling them inline keeps the whole tree visible to tests that
// walk page.js without a DOM.
const heroArtwork = ({ title, badge = "", active = false }) => (
  <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-neutral-800 bg-[#0f172a] text-2xl font-black text-white shadow-sm retro-grooves">
    {initialLetter(title)}
    {badge && (
      <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-md bg-gold px-1 text-[10px] font-bold uppercase tracking-wider text-white ring-2 ring-white">
        {badge}
      </span>
    )}
    {active && (
      <span className="absolute -bottom-1 -right-1 flex h-3 w-3 rounded-full bg-accent ring-2 ring-white" />
    )}
  </div>
);

const progressCard = ({ song, isPlaying, currentTime, duration }) => {
  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const max = Math.max(1, Math.round(duration));
  const now = Math.round(Math.min(currentTime, duration || 0));

  return (
    <div className="flex min-w-0 items-center gap-3">
      {heroArtwork({ title: song.title, active: isPlaying })}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="min-w-0 truncate text-sm font-semibold leading-5 text-neutral-900">
            {song.title}
          </p>
          {isPlaying && (
            <span className="waveform flex h-3 shrink-0 items-end text-accent" aria-hidden="true">
              <span /><span /><span /><span />
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs leading-4 text-neutral-500">
          {song.author || "Unknown artist"}
        </p>
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200"
          role="progressbar"
          aria-label="Playback progress"
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={now}
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] tabular-nums text-neutral-500">
          <span>{formatTime(currentTime)}</span>
          <span>{duration > 0 ? formatTime(duration) : "--:--"}</span>
        </div>
      </div>
    </div>
  );
};

const newCard = ({ title, label, description }) => (
  <div className="flex min-w-0 items-center gap-3">
    {heroArtwork({ title, badge: "N" })}
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase leading-none tracking-wider text-accent">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold leading-5 text-neutral-900">{title}</p>
      <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-neutral-500">{description}</p>
    </div>
  </div>
);

const standoutCard = ({ song, onPlay }) => (
  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase leading-none tracking-wider text-neutral-500">
      <Star size={10} aria-hidden="true" />
      Standout
    </div>
    <div className="mt-2.5 flex min-w-0 items-center gap-2.5">
      {heroArtwork({ title: song.title })}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-5 text-neutral-900">{song.title}</p>
        <p className="mt-0.5 truncate text-xs leading-4 text-neutral-500">
          {song.author || "Unknown artist"}
        </p>
      </div>
      <button
        type="button"
        onClick={onPlay}
        onMouseEnter={() => prefetchSongAudio(song)}
        aria-label={`Play ${song.title}`}
        className="tap-sm flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white transition hover:bg-accent/90 active:scale-95"
      >
        <Play size={13} fill="currentColor" className="ml-0.5" />
      </button>
    </div>
    <Link
      href="/library?tab=standouts"
      className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-500 transition hover:text-accent"
    >
      View Standouts <ArrowRight size={12} aria-hidden="true" />
    </Link>
  </div>
);

const verseCard = ({
  verse,
  copyState,
  paused,
  reduceMotion,
  onCopy,
  onPause,
  onPrev,
  onNext,
}) => (
  <div className="w-full">
    <div className="flex min-w-0 items-start gap-2">
      <Quote size={12} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
      <div className="min-w-0">
        <p className="line-clamp-2 text-xs italic leading-snug text-neutral-700">
          “{verse.text}”
        </p>
        <p className="mt-0.5 text-xs font-bold text-accent">{verse.ref}</p>
        {copyState === "failed" && (
          <p role="alert" className="mt-1 text-xs font-semibold text-red-600">
            Couldn’t copy — select the verse and copy it by hand.
          </p>
        )}
      </div>
    </div>
    <div className="mt-2 flex items-center gap-1">
      <button
        type="button"
        onClick={onPrev}
        aria-label="Previous verse"
        className="tap-sm flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:text-neutral-700"
      >
        <ChevronLeft size={14} aria-hidden="true" />
      </button>
      {!reduceMotion && (
        <button
          type="button"
          onClick={onPause}
          aria-pressed={paused}
          aria-label={paused ? "Resume verse rotation" : "Pause verse rotation"}
          title={paused ? "Resume verse rotation" : "Pause verse rotation"}
          className="tap-sm flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:text-neutral-700"
        >
          {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
        </button>
      )}
      <button
        type="button"
        onClick={onNext}
        aria-label="Next verse"
        className="tap-sm flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:text-neutral-700"
      >
        <ChevronRight size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onCopy}
        aria-label={copyState === "copied" ? "Verse copied" : "Copy verse"}
        title="Copy verse"
        className="tap-sm flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:text-neutral-700"
      >
        {copyState === "copied" ? (
          <Check size={14} className="font-bold text-accent" aria-hidden="true" />
        ) : (
          <Copy size={14} aria-hidden="true" />
        )}
      </button>
      <span role="status" className="sr-only">
        {copyState === "copied" ? "Verse copied" : ""}
      </span>
    </div>
  </div>
);

const actionButton = (action, variant) => {
  const Icon = action.icon;
  const className = variant === "primary" ? "btn-primary" : "btn-secondary";
  const content = (
    <>
      {Icon && <Icon size={16} aria-hidden="true" />}
      <span>{action.label}</span>
    </>
  );

  if (action.type === "link") {
    return (
      <Link href={action.href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      className={className}
    >
      {content}
    </button>
  );
};

export default function HomeHero({
  songs = [],
  newestSongs = [],
  featuredSongs = [],
  standoutSong = null,
  onShuffleAll,
  isLoading = false,
}) {
  const {
    activeSong,
    setActiveSong,
    recentlyPlayed,
    hasRealHistory,
    requestTogglePlay,
    requestOpenPlayer,
  } = usePlayer();
  const { user, profile, loading: authLoading } = useAuth();
  const { items, unread, unreadIds, dismissedIds } = useNotificationFeed();
  const { isPlaying, currentTime, duration } = usePlaybackStatus();

  const season = getWorshipSeason();
  const greeting = greetingFor(new Date().getHours());
  const GreetingIcon = greeting.icon;
  const userName = profile?.first_name || null;

  const newRelease = useMemo(() => {
    if (!unread) return null;
    const unreadSet = new Set(unreadIds || []);
    const dismissed = new Set(dismissedIds || []);
    return (
      (items || []).find((item) => {
        const id = normalizeNotificationId(item.id);
        if (id === null || !unreadSet.has(id) || dismissed.has(id)) return false;
        const kind = normalizeNotificationKind(item.kind);
        return kind === "release" || kind === "update";
      }) || null
    );
  }, [items, unread, unreadIds, dismissedIds]);

  const releaseSong = useMemo(() => {
    const match = /^\/share\/([^/?#]+)/.exec(newRelease?.url || "");
    if (!match) return null;
    const id = decodeURIComponent(match[1]);
    return songs.find((song) => String(song.id) === id) || null;
  }, [newRelease, songs]);

  // Date.now() is impure, so the clock is read after mount and refreshed hourly.
  // It also keeps "new this week" honest on a tab left open across midnight.
  const [now, setNow] = useState(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const interval = setInterval(tick, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const newThisWeek = useMemo(() => {
    if (now == null) return [];
    const cutoff = now - 7 * 86_400_000;
    return songs.filter((song) => {
      const created = Date.parse(song?.created_at);
      return Number.isFinite(created) && created >= cutoff;
    });
  }, [songs, now]);

  const latestNewSong = newThisWeek[0] || newestSongs[0] || null;
  const latestNewUnplayed = Boolean(
    latestNewSong &&
      newThisWeek.length > 0 &&
      !recentlyPlayed.some((song) => song.id === latestNewSong.id)
  );

  const heroState = useMemo(() => {
    if (activeSong) return isPlaying ? "playing" : "paused";
    if (newRelease) return "announcement";
    if (hasRealHistory && latestNewUnplayed) return "new";
    if (hasRealHistory && recentlyPlayed.length > 0) return "returning";
    return "discover";
  }, [activeSong, isPlaying, newRelease, hasRealHistory, latestNewUnplayed, recentlyPlayed.length]);

  const stats = useMemo(
    () => ({
      total: songs.length,
      artists: new Set(songs.map((song) => song.author).filter(Boolean)).size,
      newCount: newThisWeek.length,
    }),
    [songs, newThisWeek.length]
  );

  const playSong = useCallback(
    (song, queue) => {
      if (!song) return;
      setActiveSong(song, queue && queue.length > 0 ? queue : songs);
    },
    [setActiveSong, songs]
  );

  // Scripture capsule -------------------------------------------------------
  const [verseIndex, setVerseIndex] = useState(0);
  const [verseCopyState, setVerseCopyState] = useState("idle");
  const [versePaused, setVersePaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const verseList = useMemo(() => {
    if (!season.verse) return verses;
    return [season.verse, ...verses.filter((verse) => verse.ref !== season.verse.ref)];
  }, [season]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // WCAG 2.2.2: the capsule updates on its own, so it needs a stop control and
  // has to respect reduced motion. It also only rotates while no track is in
  // the player — that surface is replaced by the progress card.
  useEffect(() => {
    if (activeSong || versePaused || reduceMotion) return;
    const interval = setInterval(() => {
      setVerseIndex((prev) => (prev + 1) % verseList.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [activeSong, versePaused, reduceMotion, verseList.length]);

  const verse = verseList[verseIndex] || verses[0];

  const copyVerse = useCallback(async () => {
    const current = verseList[verseIndex] || verses[0];
    const text = `"${current.text}" — ${current.ref}`;
    try {
      // navigator.clipboard is absent outside secure contexts, which throws
      // here rather than failing the write quietly.
      await navigator.clipboard.writeText(text);
      setVerseCopyState("copied");
    } catch {
      setVerseCopyState("failed");
    }
    setTimeout(() => setVerseCopyState("idle"), 2500);
  }, [verseIndex, verseList]);

  const stepVerse = useCallback(
    (direction) => {
      setVersePaused(true);
      setVerseIndex((prev) => (prev + direction + verseList.length) % verseList.length);
    },
    [verseList.length]
  );

  // Content per state ------------------------------------------------------
  const heroContent = useMemo(() => {
    switch (heroState) {
      case "playing":
      case "paused": {
        const paused = heroState === "paused";
        const elapsed = currentTime > 0 ? formatTime(currentTime) : null;
        const total = duration > 0 ? formatTime(duration) : null;
        const timing = paused
          ? elapsed
            ? `Paused at ${elapsed}`
            : null
          : elapsed && total
            ? `${elapsed} of ${total}`
            : null;
        return {
          label: paused ? "Ready in the player" : "Now playing",
          title: activeSong?.title || "Untitled",
          description: [activeSong?.author, timing].filter(Boolean).join(" · "),
        };
      }
      case "announcement":
        return {
          label:
            normalizeNotificationKind(newRelease?.kind) === "update"
              ? "New recording"
              : "New this week",
          title: newRelease?.title || "New release",
          description:
            newRelease?.body ||
            (releaseSong?.author
              ? `New from ${releaseSong.author}.`
              : "Just added to the library."),
        };
      case "new":
        return {
          label: "New this week",
          title: latestNewSong?.title || "New song",
          description: [latestNewSong?.author, addedLabel(latestNewSong?.created_at, now)]
            .filter(Boolean)
            .join(" · "),
        };
      case "returning":
        return {
          label: "Welcome back",
          title: "Pick up where you left off",
          description: recentlyPlayed[0]
            ? `Last played: ${recentlyPlayed[0].title}${
                recentlyPlayed[0].author ? ` — ${recentlyPlayed[0].author}` : ""
              }`
            : "Your recent listening is ready.",
        };
      default:
        return {
          label: season.label,
          title: season.title,
          description: season.description,
        };
    }
  }, [
    heroState,
    activeSong,
    currentTime,
    duration,
    newRelease,
    releaseSong,
    latestNewSong,
    recentlyPlayed,
    season,
    now,
  ]);

  const primaryAction = useMemo(() => {
    switch (heroState) {
      case "playing":
        return { type: "button", label: "Pause", icon: Pause, onClick: requestTogglePlay };
      case "paused":
        return { type: "button", label: "Resume", icon: Play, onClick: requestTogglePlay };
      case "announcement":
        if (releaseSong) {
          return {
            type: "button",
            label: "Listen now",
            icon: Play,
            onClick: () => playSong(releaseSong, songs),
          };
        }
        return {
          type: "link",
          label: "Open announcement",
          href: newRelease?.url || "/notifications",
        };
      case "new":
        return latestNewSong
          ? {
              type: "button",
              label: "Listen now",
              icon: Play,
              onClick: () => playSong(latestNewSong, newestSongs),
            }
          : null;
      case "returning":
        return recentlyPlayed[0]
          ? {
              type: "button",
              label: "Continue listening",
              icon: Play,
              onClick: () => playSong(recentlyPlayed[0], recentlyPlayed),
            }
          : null;
      default:
        return featuredSongs[0]
          ? {
              type: "button",
              label: "Start listening",
              icon: Play,
              onClick: () => playSong(featuredSongs[0], featuredSongs),
            }
          : null;
    }
  }, [
    heroState,
    releaseSong,
    latestNewSong,
    recentlyPlayed,
    featuredSongs,
    newestSongs,
    songs,
    playSong,
    requestTogglePlay,
    newRelease,
  ]);

  const secondaryAction = useMemo(() => {
    if (heroState === "playing" || heroState === "paused") {
      return { type: "button", label: "Open player", onClick: requestOpenPlayer };
    }
    if (heroState === "announcement") {
      return { type: "link", label: "All announcements", href: "/notifications" };
    }
    return {
      type: "button",
      label: "Shuffle All",
      icon: Shuffle,
      onClick: onShuffleAll,
      disabled: songs.length === 0,
    };
  }, [heroState, requestOpenPlayer, onShuffleAll, songs.length]);

  let rightRail;
  if (heroState === "playing" || heroState === "paused") {
    rightRail = progressCard({ song: activeSong, isPlaying, currentTime, duration });
  } else if (heroState === "announcement" || heroState === "new") {
    rightRail = newCard({
      title: heroContent.title,
      label: heroContent.label,
      description: heroContent.description,
    });
  } else if (heroState === "returning" && standoutSong) {
    rightRail = standoutCard({
      song: standoutSong,
      onPlay: () => playSong(standoutSong, songs),
    });
  } else {
    rightRail = verseCard({
      verse,
      copyState: verseCopyState,
      paused: versePaused,
      reduceMotion,
      onCopy: copyVerse,
      onPause: () => setVersePaused((prev) => !prev),
      onPrev: () => stepVerse(-1),
      onNext: () => stepVerse(1),
    });
  }

  return (
    <section
      aria-labelledby="home-hero-title"
      className="relative overflow-hidden rounded-xl border border-accent/10 bg-gradient-to-br from-accent/[0.07] via-white to-accent/[0.025] p-4 shadow-2xs sm:p-5 md:p-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded border border-accent/10 bg-accent/[0.05] px-2 py-0.5 text-xs font-semibold text-neutral-700">
              <GreetingIcon size={12} className="text-accent" aria-hidden="true" />
              <span>
                {greeting.text}
                {userName && (
                  <>
                    , <strong className="font-bold text-neutral-900">{userName}</strong>
                  </>
                )}
              </span>
            </span>
            {season.label && (
              <span className="inline-flex items-center rounded border border-accent/15 bg-accent/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                {season.label}
              </span>
            )}
          </div>

          <div>
            {heroContent.label && (
              <p className="text-[10px] font-bold uppercase leading-none tracking-wider text-accent">
                {heroContent.label}
              </p>
            )}
            <h1 id="home-hero-title" className="page-title mt-1">
              {heroContent.title}
            </h1>
            <p className="mt-1 line-clamp-2 max-w-md text-sm leading-relaxed text-neutral-500">
              {heroContent.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {primaryAction && actionButton(primaryAction, "primary")}
            {secondaryAction && actionButton(secondaryAction, "secondary")}
            <Link
              href="/songs"
              className="tap-sm inline-flex min-h-9 items-center gap-1.5 rounded-full px-2 py-2 text-xs font-semibold text-neutral-600 transition hover:bg-accent/[0.06] hover:text-accent"
            >
              Browse songs <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>

          {!isLoading && stats.total > 0 && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
              <span>
                {stats.total} {stats.total === 1 ? "track" : "tracks"}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {stats.artists} {stats.artists === 1 ? "artist" : "artists"}
              </span>
              {stats.newCount > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <a
                    href="#newest-songs"
                    className="tap-sm inline-flex items-center gap-1 rounded-md font-semibold text-accent hover:underline"
                  >
                    {stats.newCount} new this week
                  </a>
                </>
              )}
              {hasRealHistory && recentlyPlayed.length > 0 && (
                <a
                  href="#recently-played"
                  className="tap-sm inline-flex items-center gap-1 rounded-md font-semibold text-accent hover:underline"
                >
                  <Clock size={13} aria-hidden="true" /> Recently played
                </a>
              )}
              <Link
                href="/library?tab=standouts"
                className="tap-sm inline-flex items-center gap-1 rounded-md font-semibold text-neutral-500 transition hover:text-accent"
              >
                <Star size={13} aria-hidden="true" /> Standouts
              </Link>
              {!authLoading && !user && (
                <Link
                  href="/auth"
                  className="tap-sm inline-flex items-center gap-1 rounded-md font-semibold text-neutral-500 transition hover:text-accent"
                >
                  <LogIn size={13} aria-hidden="true" /> Sign in to save your place
                </Link>
              )}
            </p>
          )}
        </div>

        <div className="min-w-0 w-full shrink-0 border-t border-accent/10 pt-3 lg:w-72 lg:border-l lg:border-accent/10 lg:border-t-0 lg:pl-5 lg:pt-0">
          {rightRail}
        </div>
      </div>
    </section>
  );
}
