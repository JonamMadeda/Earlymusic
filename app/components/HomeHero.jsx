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
import { useNotificationFeed } from "@/lib/notificationFeed";
import { normalizeNotificationId, normalizeNotificationKind } from "@/lib/notifications";
import { getWorshipSeason } from "@/lib/worshipSeason";
import { homepageLengthLabel } from "@/lib/timeFormat";
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
  if (hour < 12) return { text: "Good morning", watch: "Morning Altar", icon: Sunrise };
  if (hour < 18) return { text: "Good afternoon", watch: "Midday Sanctuary", icon: Sun };
  return { text: "Good evening", watch: "Evening Vigil", icon: Moon };
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
const heroArtwork = ({ title, badge = "" }) => (
  <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-neutral-800 bg-[#0f172a] text-2xl font-bold text-white shadow-sm retro-grooves">
    {initialLetter(title)}
    {badge && (
      <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-md bg-ink px-1 text-[10px] font-semibold uppercase tracking-wider text-white ring-2 ring-white">
        {badge}
      </span>
    )}
  </div>
);

const newCard = ({ title, label, description }) => (
  <div className="flex min-w-0 items-center gap-3">
    {heroArtwork({ title, badge: "N" })}
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase leading-none tracking-wider text-accent">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold leading-5 text-neutral-900">{title}</p>
      <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-neutral-500">{description}</p>
    </div>
  </div>
);

const standoutCard = ({ song, onPlay }) => {
  const length = homepageLengthLabel(song);
  const posture = (song.category || "").trim() || "Worship";

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase leading-none tracking-wider text-neutral-500">
        <span className="flex items-center gap-1.5">
          <Star size={10} aria-hidden="true" />
          Standout Station
        </span>
        {length && (
          <span className="flex items-center gap-1 font-semibold tabular-nums text-neutral-600">
            <Clock size={10} aria-hidden="true" />
            {length}
          </span>
        )}
      </div>
      <div className="mt-2.5 flex min-w-0 items-center gap-2.5">
        {heroArtwork({ title: song.title })}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-5 text-neutral-900">{song.title}</p>
          <p className="mt-0.5 truncate text-xs leading-4 text-neutral-500">
            <span className="font-medium text-accent">{posture}</span>
            <span className="sr-only"> by {song.author || "Unknown artist"}</span>
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
};

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
        <p className="mt-0.5 text-xs font-semibold text-accent">{verse.ref}</p>
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
    requestOpenPlayer,
  } = usePlayer();
  const { user, profile, loading: authLoading } = useAuth();
  const { items, unread, unreadIds, dismissedIds } = useNotificationFeed();

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
  // It also keeps "recently added" honest on a tab left open across midnight.
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
    if (activeSong) return "active";
    if (newRelease) return "announcement";
    if (hasRealHistory && latestNewUnplayed) return "new";
    if (hasRealHistory && recentlyPlayed.length > 0) return "returning";
    return "discover";
  }, [activeSong, newRelease, hasRealHistory, latestNewUnplayed, recentlyPlayed.length]);

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
  // the player — the rail shows a standout or the verse instead.
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
      case "active":
        return {
          label: "In your player",
          title: activeSong?.title || "Untitled",
          description: activeSong?.author || "Ready to keep listening.",
        };
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
                homepageLengthLabel(recentlyPlayed[0])
                  ? ` · ${homepageLengthLabel(recentlyPlayed[0])} station`
                  : recentlyPlayed[0].author
                    ? ` — ${recentlyPlayed[0].author}`
                    : ""
              }`
            : "Your worship stations are ready.",
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
    newRelease,
    releaseSong,
    latestNewSong,
    recentlyPlayed,
    season,
    now,
  ]);

  const primaryAction = useMemo(() => {
    switch (heroState) {
      case "active":
        return { type: "button", label: "Open player", icon: ArrowRight, onClick: requestOpenPlayer };
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
    requestOpenPlayer,
    newRelease,
  ]);

  const secondaryAction = useMemo(() => {
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
  }, [heroState, onShuffleAll, songs.length]);

  const railStandout =
    standoutSong && standoutSong.id !== activeSong?.id ? standoutSong : null;
  const scriptureRail = verseCard({
    verse,
    copyState: verseCopyState,
    paused: versePaused,
    reduceMotion,
    onCopy: copyVerse,
    onPause: () => setVersePaused((prev) => !prev),
    onPrev: () => stepVerse(-1),
    onNext: () => stepVerse(1),
  });

  let rightRail;
  if (heroState === "announcement" || heroState === "new") {
    rightRail = newCard({
      title: heroContent.title,
      label: heroContent.label,
      description: heroContent.description,
    });
  } else if ((heroState === "returning" || heroState === "active") && railStandout) {
    rightRail = standoutCard({
      song: railStandout,
      onPlay: () => playSong(railStandout, songs),
    });
  } else {
    rightRail = scriptureRail;
  }

  return (
    <section
      aria-labelledby="home-hero-title"
      className="relative rounded-xl border border-accent/10 bg-gradient-to-br from-accent/[0.07] via-white to-accent/[0.025] p-4 shadow-2xs sm:p-5 md:p-6"
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
              {greeting.watch && (
                <>
                  <span aria-hidden="true" className="text-neutral-300">·</span>
                  <span className="font-medium text-neutral-500">{greeting.watch}</span>
                </>
              )}
            </span>
            {season.label && (
              <span className="inline-flex items-center rounded border border-accent/15 bg-accent/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                {season.label}
              </span>
            )}
          </div>

          <div>
            {heroContent.label && (
              <p className="text-[10px] font-semibold uppercase leading-none tracking-wider text-accent">
                {heroContent.label}
              </p>
            )}
            <h1 id="home-hero-title" className="page-title mt-1">
              <span className="sr-only">Luumbo Home — </span>
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
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs leading-4 text-neutral-500">
              <span className="whitespace-nowrap">
                {stats.total} {stats.total === 1 ? "station" : "stations"}
              </span>
              {stats.artists > 1 ? (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <span aria-hidden="true" className="text-neutral-300">·</span>
                  <span>
                    {stats.artists} artists
                  </span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <span aria-hidden="true" className="text-neutral-300">·</span>
                  <span>Ministry Archive</span>
                </span>
              )}
              {stats.newCount > 0 && (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <span aria-hidden="true" className="text-neutral-300">·</span>
                  <a
                    href="#newest-songs"
                    className="tap-sm inline-flex min-h-8.5 items-center gap-1 rounded-md font-semibold text-accent hover:underline"
                  >
                    {stats.newCount} recently added
                  </a>
                </span>
              )}
              {hasRealHistory && recentlyPlayed.length > 0 && (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <span aria-hidden="true" className="text-neutral-300">·</span>
                  <a
                    href="#recently-played"
                    className="tap-sm inline-flex min-h-8.5 items-center gap-1 rounded-md font-semibold text-accent hover:underline"
                  >
                    <Clock size={13} aria-hidden="true" /> Continue Listening
                  </a>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span aria-hidden="true" className="text-neutral-300">·</span>
                <a
                  href="#featured-songs"
                  className="tap-sm inline-flex min-h-8.5 items-center gap-1 rounded-md font-semibold text-neutral-500 transition hover:text-accent"
                >
                  <Star size={13} aria-hidden="true" /> Featured
                </a>
              </span>
              {!authLoading && !user && (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <span aria-hidden="true" className="text-neutral-300">·</span>
                  <Link
                    href="/auth"
                    className="tap-sm inline-flex min-h-8.5 items-center gap-1 rounded-md font-semibold text-neutral-500 transition hover:text-accent"
                  >
                    <LogIn size={13} aria-hidden="true" /> Sign in to save your place
                  </Link>
                </span>
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
