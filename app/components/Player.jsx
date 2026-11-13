"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";

import { apiFetch } from "@/lib/apiFetch";
import { getAudioPublicUrl } from "@/lib/audioUrl";
import { getSongArtwork } from "@/lib/artwork";
import { pickNextSong } from "@/lib/playbackQueue";
import { isSongDownloaded } from "@/lib/downloadManager";
import { usePlayer, PLAYBACK_POSITION_KEY } from "../context/PlayerContext";
import {
  Play,
  Pause,
  Volume,
  VolumeX,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  ChevronDown,
  Heart,
  AlertTriangle,
  ListMusic,
  Share2,
  Check,
  Download,
} from "lucide-react";
import { getCachedAudioUrl, evictCachedAudio } from "@/lib/cacheUtils";
import SongAvatar, { VinylArtwork } from "./SongAvatar";
import { SleepTimerControl } from "./SleepTimer";
import { ThinProgress, SeekBar, TimeReadout } from "./PlayerProgress";
import PlayerQueue from "./PlayerQueue";
import SongOverflowMenu from "./SongOverflowMenu";
import { useAuth } from "../context/AuthContext";

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5];
const REPEAT_ORDER = ["off", "all", "one"];
const REPEAT_LABELS = {
  off: "Repeat off",
  all: "Repeat queue",
  one: "Repeat this song",
};
const SEEK_STEP = 5;
const SWIPE_CLOSE_DISTANCE = 80;

const Player = () => {
  const audioRef = useRef(null);
  const {
    activeSong: song,
    queue,
    setActiveSong: onSongSelect,
    restorePlayback,
    allSongs,
    sleepTimerStopSignal,
    volume,
    setVolume,
    isMuted,
    setIsMuted,
    isShuffle,
    setIsShuffle,
    repeatMode,
    setRepeatMode,
    addToQueueNext,
    removeFromQueue,
    clearQueue,
    moveInQueue,
  } = usePlayer();

  // Skip/auto-advance queue. Pages normally pass the visible list as the
  // queue; fall back to the full library so next/previous still work when a
  // song was started without one (share links, single-song deep links).
  const songs = useMemo(
    () => (queue && queue.length > 0 ? queue : allSongs || []),
    [queue, allSongs]
  );
  // Only an explicit queue can be reordered — the library fallback is not ours
  // to edit.
  const queueEditable = queue.length > 0;

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isLikePending, setIsLikePending] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioSongId, setAudioSongId] = useState(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isOffline, setIsOffline] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");
  const [liveMessage, setLiveMessage] = useState("");

  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Latest active song id — async handlers compare against this so a
  // response for a previously played song can't overwrite current state.
  const activeSongIdRef = useRef(null);
  useEffect(() => {
    activeSongIdRef.current = song?.id ?? null;
  }, [song?.id]);

  // "Opening…" — a song is selected but its playable URL isn't ready yet.
  // "Buffering…" — the URL is set but the audio element is waiting on data.
  const isPreparing = !!song && audioSongId !== song.id;
  const isBusy = (isPreparing || isBuffering) && !audioError;

  const BusySpinner = ({ size = 16 }) => (
    <span
      aria-label="Loading"
      className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent"
      style={{ width: size, height: size }}
    />
  );

  const playRef = useRef(false);
  const loadIdRef = useRef(0);
  const isPlayingRef = useRef(false);
  const skipWhilePausedRef = useRef(false);
  const blobUrlRef = useRef(null);
  const publicUrlRef = useRef(null);
  const networkFallbackTriedRef = useRef(false);
  const errorCountRef = useRef(0);
  // Songs that failed since the last manual pick — auto-advance skips them so
  // one broken track can't trap playback in a retry loop.
  const failedSongIdsRef = useRef(new Set());
  // Tracks already played in this shuffle pass, so "random" doesn't mean
  // "the same three songs on repeat".
  const shuffleHistoryRef = useRef(new Set());
  // Song id we auto-advanced to, so the song-change effect can tell an
  // automatic move apart from the user picking something new.
  const autoTargetRef = useRef(null);
  // Queue navigation preserves the shuffle pass, independently of whether
  // failed tracks should be retried after a user-initiated skip.
  const queueTargetRef = useRef(null);
  const loadedSourceRef = useRef(null);
  const handledSleepStopRef = useRef(sleepTimerStopSignal);
  const autoAdvanceTimerRef = useRef(null);
  const feedbackTimerRef = useRef(null);
  const lastPrevPressRef = useRef(0);
  const resumePositionRef = useRef(null);
  const lastPositionSaveRef = useRef(0);
  const closeButtonRef = useRef(null);
  const modalRef = useRef(null);
  const lastFocusedRef = useRef(null);
  const historyPushedRef = useRef(false);
  const swipeStartRef = useRef(null);
  const MAX_AUTO_RETRIES = 1;
  const AUTO_ADVANCE_DELAY = 1200;
  const PREV_DOUBLE_PRESS_WINDOW = 2000;

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PLAYBACK_POSITION_KEY) || "null");
      if (!saved?.song?.id || !saved.song.song_path || !(saved.position > 5)) return;
      resumePositionRef.current = { songId: saved.song.id, position: saved.position };
      skipWhilePausedRef.current = true;
      restorePlayback(saved.song);
    } catch {
      localStorage.removeItem(PLAYBACK_POSITION_KEY);
    }
  }, [restorePlayback]);

  const savePlaybackPosition = useCallback(() => {
    if (!song || audioSongId !== song.id || !audioRef.current) return;
    // A restored session mounts paused at 0; saving now would delete the
    // stored position before onLoadedMetadata can seek to it.
    if (resumePositionRef.current) return;
    const position = audioRef.current.currentTime;
    const total = audioRef.current.duration;
    try {
      if (position < 5 || (Number.isFinite(total) && total - position < 5)) {
        localStorage.removeItem(PLAYBACK_POSITION_KEY);
        return;
      }
      localStorage.setItem(
        PLAYBACK_POSITION_KEY,
        JSON.stringify({ song, position, updatedAt: Date.now() })
      );
    } catch {}
  }, [song, audioSongId]);

  useEffect(() => {
    if (!isPlaying) savePlaybackPosition();
  }, [isPlaying, savePlaybackPosition]);

  useEffect(() => () => savePlaybackPosition(), [savePlaybackPosition]);

  // Mobile browsers kill the tab without running React cleanup, so the resume
  // position has to be written on the way out too. `pagehide` covers bfcache
  // and mobile task kills; `beforeunload` covers desktop tab closes.
  useEffect(() => {
    const onPageHide = () => savePlaybackPosition();
    const onBeforeUnload = () => savePlaybackPosition();
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [savePlaybackPosition]);

  useEffect(() => {
    const timeout = setTimeout(() => setIsOffline(isSongDownloaded(song?.id)), 0);
    return () => clearTimeout(timeout);
  }, [song?.id]);

  const announce = useCallback((message, share = "") => {
    setLiveMessage(message);
    setShareFeedback(share);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => {
      setLiveMessage("");
      setShareFeedback("");
    }, 3000);
  }, []);

  useEffect(
    () => () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    },
    []
  );

  // --- Auto-advance on playback error ---
  const clearAutoAdvanceTimer = useCallback(() => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  // Clear pending retry/auto-advance timers on unmount
  useEffect(() => {
    return () => {
      clearAutoAdvanceTimer();
    };
  }, [clearAutoAdvanceTimer]);

  // Sleep timer expired — stop playback and release media resources.
  useEffect(() => {
    if (sleepTimerStopSignal === handledSleepStopRef.current) return;
    handledSleepStopRef.current = sleepTimerStopSignal;

    playRef.current = false;
    isPlayingRef.current = false;
    setIsPlaying(false);
    setIsBuffering(false);
    clearAutoAdvanceTimer();

    if (audioRef.current) {
      audioRef.current.pause();
    }

    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "none";
    }
  }, [sleepTimerStopSignal, clearAutoAdvanceTimer]);

  useEffect(() => {
    const target = queueTargetRef.current;
    const isQueueMove = target?.song === song && target?.songs === songs;
    queueTargetRef.current = null;
    if (!isQueueMove) shuffleHistoryRef.current.clear();
    // A fresh manual selection or queue starts a new pass, even for the same
    // song id. Next/Previous and automatic advancement keep the existing pass.
    if (song?.id) shuffleHistoryRef.current.add(song.id);
  }, [song, songs]);

  // Reset error count when the song changes
  useEffect(() => {
    // A manual pick starts a fresh failure cycle; an automatic move keeps the
    // list of dead tracks so auto-advance doesn't bounce back to them.
    const isAutoAdvance =
      autoTargetRef.current && autoTargetRef.current === song?.id;
    autoTargetRef.current = null;
    if (!isAutoAdvance) {
      failedSongIdsRef.current.clear();
    }
    if (resumePositionRef.current && resumePositionRef.current.songId !== song?.id) {
      resumePositionRef.current = null;
    }

    errorCountRef.current = 0;
    networkFallbackTriedRef.current = false;
    publicUrlRef.current = null;
    setIsBuffering(false);
    lastPrevPressRef.current = 0;
    clearAutoAdvanceTimer();
  }, [song?.id, clearAutoAdvanceTimer]);

  useEffect(() => {
    setIsLiked(false);
    if (!user || !song) return;
    const songId = song.id;
    apiFetch(`/api/data/saved_songs?song_id=${songId}`)
      .then((data) => {
        if (activeSongIdRef.current === songId) setIsLiked(Array.isArray(data) && data.length > 0);
      })
      .catch((error) => console.error("Unable to check saved song:", error));
  }, [user, song]);

  const toggleLike = async () => {
    if (!song) return;
    if (!user) {
      router.push(`/auth?redirectTo=${encodeURIComponent(pathname)}`);
      return;
    }
    if (isLikePending) return;

    const songId = song.id;
    const next = !isLiked;
    // Optimistic: the heart reacts instantly, and reverts if the request fails.
    setIsLiked(next);
    setIsLikePending(true);
    try {
      if (next) {
        await apiFetch("/api/data/saved_songs", {
          method: "POST",
          body: JSON.stringify({ song_id: songId }),
        });
      } else {
        // Filters must live in the query string: the data API ignores
        // DELETE bodies, so a filterless call would wipe every saved song.
        await apiFetch(`/api/data/saved_songs?song_id=${songId}`, { method: "DELETE" });
      }
    } catch (error) {
      console.error("Unable to update saved song:", error);
      if (activeSongIdRef.current === songId) setIsLiked(!next);
    } finally {
      setIsLikePending(false);
    }
  };

  const handleShare = async (e) => {
    e?.stopPropagation?.();
    if (!song) return;
    try {
      const { shareSong } = await import("@/lib/share");
      const result = await shareSong(song);
      if (result === "copied") {
        announce("Link copied to clipboard.", "copied");
      } else if (result === "failed") {
        announce("Sharing failed. Copy the link from your address bar.", "failed");
      }
    } catch (error) {
      console.error("Unable to share song:", error);
      announce("Sharing failed. Copy the link from your address bar.", "failed");
    }
  };

  const openFullPlayer = useCallback(() => {
    lastFocusedRef.current = document.activeElement;
    setShowFullPlayer(true);
  }, []);

  // One close path: the button, Escape and swipe all land here, and the extra
  // history entry is only popped if this player actually pushed it.
  const closeFullPlayer = useCallback(() => {
    setShowFullPlayer(false);
    if (historyPushedRef.current) {
      historyPushedRef.current = false;
      window.history.back();
    }
  }, []);

  // Mobile back button closes full-screen player instead of leaving the app
  useEffect(() => {
    if (!showFullPlayer) return;

    window.history.pushState({ player: true }, "", window.location.href);
    historyPushedRef.current = true;

    const handlePopState = () => {
      historyPushedRef.current = false;
      setShowFullPlayer(false);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [showFullPlayer]);

  // The overlay is a modal: the page behind it must not scroll, take focus or
  // answer clicks, and focus returns to whatever opened it.
  useEffect(() => {
    if (!showFullPlayer) return;

    const shell = document.getElementById("app-shell");
    const nav = document.getElementById("bottom-nav");
    const scroller = document.getElementById("app-scroll");
    const previousOverflow = scroller?.style.overflow ?? "";
    if (shell) shell.inert = true;
    if (nav) nav.inert = true;
    if (scroller) scroller.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    return () => {
      if (shell) shell.inert = false;
      if (nav) nav.inert = false;
      if (scroller) scroller.style.overflow = previousOverflow;
      const target = lastFocusedRef.current;
      if (target && document.contains(target)) target.focus?.();
    };
  }, [showFullPlayer]);

  useEffect(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          setIsPlaying(false);
        });
      }
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
    audioRef.current.muted = isMuted;
  }, [volume, isMuted]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate, audioUrl]);

  const syncMediaPosition = useCallback(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: audio.duration,
        playbackRate: audio.playbackRate || 1,
        position: Math.min(audio.currentTime, audio.duration),
      });
    } catch {}
  }, []);

  const seekBy = useCallback((delta) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.min(
      Math.max(0, audio.currentTime + delta),
      audio.duration
    );
    syncMediaPosition();
  }, [syncMediaPosition]);

  const handleSeek = useCallback((time) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    syncMediaPosition();
  }, [syncMediaPosition]);

  const selectNextSong = useCallback(
    (skipIds) =>
      pickNextSong({
        songs,
        currentId: song?.id,
        isShuffle,
        repeatMode,
        skipIds,
        playedIds: shuffleHistoryRef.current,
      }),
    [songs, song?.id, isShuffle, repeatMode]
  );

  const onPlayNext = useCallback(() => {
    const nextSong = selectNextSong();
    if (!nextSong) return;
    // Repeat-all can wrap onto the current track; reselecting the same song
    // wouldn't retrigger the load effect, so restart the element directly.
    if (nextSong.id === song?.id) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        if (isPlayingRef.current) {
          audioRef.current.play().catch(() => setIsPlaying(false));
        }
      }
      return;
    }
    skipWhilePausedRef.current = !isPlayingRef.current;
    queueTargetRef.current = { song: nextSong, songs };
    onSongSelect(nextSong, songs);
  }, [selectNextSong, songs, onSongSelect, song?.id]);

  // Auto-advance (track ended or unplayable): always resume playback, and
  // keep moving past tracks that fail so one dead URL can't stall the queue.
  const advanceToNext = useCallback(
    ({ reason }) => {
      if (!song) return;

      if (reason === "error") failedSongIdsRef.current.add(song.id);
      const nextSong = selectNextSong(failedSongIdsRef.current);

      if (!nextSong) {
        // End of the queue (or everything in it failed). Stop instead of
        // looping forever; a manual pick or retry starts a fresh cycle.
        failedSongIdsRef.current.clear();
        setIsPlaying(false);
        setIsBuffering(false);
        return;
      }

      // Same-song wrap (single-track repeat-all): restart without a reselect.
      if (nextSong.id === song.id) {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => setIsPlaying(false));
        }
        return;
      }

      autoTargetRef.current = nextSong.id;
      queueTargetRef.current = { song: nextSong, songs };
      skipWhilePausedRef.current = false;
      onSongSelect(nextSong, songs);
    },
    [song, selectNextSong, songs, onSongSelect]
  );

  const advanceToNextRef = useRef(null);
  useEffect(() => {
    advanceToNextRef.current = advanceToNext;
  }, [advanceToNext]);

  const onPlayPrevious = useCallback(() => {
    if (!song) return;

    const now = Date.now();
    const isDoublePress = now - lastPrevPressRef.current < PREV_DOUBLE_PRESS_WINDOW;
    lastPrevPressRef.current = now;

    // First press restarts the current song; a second press within the
    // window skips to the previous track.
    if (!isDoublePress) {
      if (audioRef.current) audioRef.current.currentTime = 0;
      return;
    }

    lastPrevPressRef.current = 0;
    if (songs.length === 0) return;
    const index = songs.findIndex((s) => s.id === song.id);
    if (index <= 0 && repeatMode !== "all") {
      if (audioRef.current) audioRef.current.currentTime = 0;
      return;
    }
    skipWhilePausedRef.current = !isPlayingRef.current;
    const prevIndex = index <= 0 ? songs.length - 1 : index - 1;
    if (songs[prevIndex].id !== song.id) {
      queueTargetRef.current = { song: songs[prevIndex], songs };
    }
    onSongSelect(songs[prevIndex], songs);
  }, [song, songs, onSongSelect, repeatMode]);

  const setPlayState = useCallback((playing) => {
    playRef.current = playing;
    isPlayingRef.current = playing;
    if (!playing) {
      clearAutoAdvanceTimer();
      audioRef.current?.pause();
    }
    setIsPlaying(playing);
  }, [clearAutoAdvanceTimer]);

  const togglePlay = useCallback(() => {
    setPlayState(!isPlayingRef.current);
  }, [setPlayState]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, [setIsMuted]);

  const cycleRepeat = useCallback(() => {
    setRepeatMode((prev) => {
      const index = REPEAT_ORDER.indexOf(prev);
      return REPEAT_ORDER[(index + 1) % REPEAT_ORDER.length];
    });
  }, [setRepeatMode]);

  const cyclePlaybackRate = useCallback(() => {
    setPlaybackRate((prev) => {
      const index = PLAYBACK_RATES.indexOf(prev);
      return PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length];
    });
  }, []);

  // Shortcuts and the Tab trap live in one handler so the modal can't leak
  // focus to the inert page behind it.
  useEffect(() => {
    if (!showFullPlayer) return;

    const onKeyDown = (event) => {
      if (event.key === "Tab") {
        const focusable = Array.from(
          modalRef.current?.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          ) || []
        ).filter((el) => el.offsetParent !== null);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === first || !modalRef.current?.contains(active))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }

      const target = event.target;
      const isTyping =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (isTyping || event.metaKey || event.ctrlKey || event.altKey) return;

      switch (event.key) {
        case " ":
          // Space on a focused button belongs to that button.
          if (target instanceof HTMLElement && target.tagName === "BUTTON") return;
          event.preventDefault();
          togglePlay();
          break;
        case "k":
        case "K":
          event.preventDefault();
          togglePlay();
          break;
        case "ArrowRight":
          event.preventDefault();
          if (event.shiftKey) onPlayNext();
          else seekBy(SEEK_STEP);
          break;
        case "ArrowLeft":
          event.preventDefault();
          if (event.shiftKey) onPlayPrevious();
          else seekBy(-SEEK_STEP);
          break;
        case "m":
        case "M":
          toggleMute();
          break;
        case "q":
        case "Q":
          setShowQueue((prev) => !prev);
          break;
        case "Escape":
          closeFullPlayer();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showFullPlayer, togglePlay, onPlayNext, onPlayPrevious, seekBy, toggleMute, closeFullPlayer]);

  const onGrabberDown = (event) => {
    if (event.pointerType === "mouse") return;
    swipeStartRef.current = event.clientY;
  };

  const onGrabberUp = (event) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (start == null) return;
    if (event.clientY - start > SWIPE_CLOSE_DISTANCE) closeFullPlayer();
  };

  const handlePlaybackError = useCallback(() => {
    clearAutoAdvanceTimer();
    errorCountRef.current += 1;
    const loadId = loadIdRef.current;
    const songId = song?.id;
    const isCurrent = () =>
      loadId === loadIdRef.current && songId === activeSongIdRef.current;

    if (errorCountRef.current <= MAX_AUTO_RETRIES) {
      // Reload without losing the intent captured before the error. A later
      // pause/stop cancels this timer and clears that intent.
      autoAdvanceTimerRef.current = setTimeout(() => {
        if (!isCurrent()) return;
        autoAdvanceTimerRef.current = null;
        if (audioRef.current && errorCountRef.current <= MAX_AUTO_RETRIES) {
          loadIdRef.current += 1;
          audioRef.current.load();
        }
      }, 800);
    } else {
      // Still failing: only advance if playback is still wanted.
      autoAdvanceTimerRef.current = setTimeout(() => {
        if (!isCurrent()) return;
        autoAdvanceTimerRef.current = null;
        if (!playRef.current) return;
        errorCountRef.current = 0;
        advanceToNext({ reason: "error" });
      }, AUTO_ADVANCE_DELAY);
    }
  }, [clearAutoAdvanceTimer, advanceToNext, song?.id]);

  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator) || !song) return;

    const generated = getSongArtwork(song.title);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: song.author,
      album: "Luumbo",
      artwork: generated
        ? [{ src: generated, sizes: "512x512", type: "image/png" }]
        : [{ src: "/favicon.ico", sizes: "192x192", type: "image/png" }],
    });

    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";

    navigator.mediaSession.setActionHandler("play", () => setPlayState(true));
    navigator.mediaSession.setActionHandler("pause", () => setPlayState(false));
    navigator.mediaSession.setActionHandler("stop", () => setPlayState(false));
    navigator.mediaSession.setActionHandler("previoustrack", onPlayPrevious);
    navigator.mediaSession.setActionHandler("nexttrack", onPlayNext);
    navigator.mediaSession.setActionHandler("seekbackward", (details) =>
      seekBy(-(details?.seekOffset || SEEK_STEP))
    );
    navigator.mediaSession.setActionHandler("seekforward", (details) =>
      seekBy(details?.seekOffset || SEEK_STEP)
    );
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (typeof details?.seekTime === "number") handleSeek(details.seekTime);
    });
    syncMediaPosition();

    return () => {
      for (const action of [
        "play",
        "pause",
        "stop",
        "previoustrack",
        "nexttrack",
        "seekbackward",
        "seekforward",
        "seekto",
      ]) {
        navigator.mediaSession.setActionHandler(action, null);
      }
    };
  }, [song, isPlaying, setPlayState, onPlayNext, onPlayPrevious, seekBy, handleSeek, syncMediaPosition]);

  useEffect(() => {
    if (!song) return;

    const publicUrl = getAudioPublicUrl(song.song_path);
    const loaded = loadedSourceRef.current;
    if (publicUrl && loaded?.songId === song.id && loaded.publicUrl === publicUrl) {
      // A fetched copy of the restored/current song is a selection, not a new
      // source. Keep metadata and buffering intact; the URL effect won't run.
      const shouldPlay = !skipWhilePausedRef.current;
      skipWhilePausedRef.current = false;
      setPlayState(shouldPlay);
      return;
    }

    const loadId = ++loadIdRef.current;
    loadedSourceRef.current = null;
    let cancelled = false;

    const loadAudio = async () => {
      setAudioError(false);
      setDuration(0);
      setIsBuffering(true);
      const loadingSongId = song.id;

      try {
        if (!publicUrl) {
          // No playable source (missing file/URL): fail fast so auto-advance
          // can move on instead of leaving the player stuck buffering.
          throw new Error("Song has no playable audio URL");
        }
        publicUrlRef.current = publicUrl;

        // Only explicit downloads fill the cache; streaming used to fetch the
        // whole file a second time just to store a copy nobody asked for.
        const cachedUrl = await getCachedAudioUrl(publicUrl);
        if (cancelled || loadId !== loadIdRef.current) {
          if (cachedUrl) URL.revokeObjectURL(cachedUrl);
          return;
        }

        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }

        if (cachedUrl) {
          blobUrlRef.current = cachedUrl;
          setAudioUrl(cachedUrl);
        } else {
          setAudioUrl(publicUrl);
        }
        setAudioSongId(loadingSongId);
        loadedSourceRef.current = { songId: loadingSongId, publicUrl };

        playRef.current = !skipWhilePausedRef.current;
        skipWhilePausedRef.current = false;
      } catch (error) {
        console.error("Unable to load audio:", error);
        if (!cancelled && loadId === loadIdRef.current) {
          playRef.current = false;
          setAudioError(true);
          setIsBuffering(false);
          // Unloadable song (missing file/URL or cache failure): skip straight
          // ahead instead of retrying a source that will never play.
          autoAdvanceTimerRef.current = setTimeout(() => {
            autoAdvanceTimerRef.current = null;
            advanceToNextRef.current?.({ reason: "error" });
          }, AUTO_ADVANCE_DELAY);
        }
      }
    };

    loadAudio();

    return () => {
      cancelled = true;
    };
  }, [song, setPlayState]);

  // Eager attempt to play as soon as the audio URL is set
  useEffect(() => {
    if (!audioUrl || !audioRef.current || !playRef.current) return;

    const loadId = loadIdRef.current;
    audioRef.current.play().then(() => {
      if (loadId !== loadIdRef.current || !playRef.current) return;
      setIsPlaying(true);
      setIsBuffering(false);
      playRef.current = false;
    }).catch(() => {
      // The media error may arrive before this rejection. Its retry owns the
      // pending intent now; an older play promise must not erase it.
      if (loadId !== loadIdRef.current || errorCountRef.current > 0) return;
      playRef.current = false;
      setIsPlaying(false);
      setIsBuffering(false);
    });
  }, [audioUrl]);

  const retryPlayback = () => {
    if (!song) return;
    setIsBuffering(true);
    // A manual retry starts a fresh cycle: forget which tracks were skipped.
    failedSongIdsRef.current.clear();
    // A manual retry also heals a bad cached copy: drop it and stream fresh.
    if (audioUrl?.startsWith("blob:") && publicUrlRef.current && !networkFallbackTriedRef.current) {
      networkFallbackTriedRef.current = true;
      evictCachedAudio(publicUrlRef.current).finally(() => {
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
        loadIdRef.current += 1;
        setAudioError(false);
        errorCountRef.current = 0;
        clearAutoAdvanceTimer();
        playRef.current = true;
        setAudioUrl(publicUrlRef.current);
      });
      return;
    }
    loadIdRef.current += 1;
    setAudioError(false);
    errorCountRef.current = 0;
    clearAutoAdvanceTimer();
    playRef.current = true;
    if (audioRef.current) {
      audioRef.current.load();
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        playRef.current = false;
      }).catch(() => {
        playRef.current = false;
        setIsPlaying(false);
      });
    }
  };

  const attribution = song?.copyright_holder || song?.license_type;
  const RepeatIcon = repeatMode === "one" ? Repeat1 : Repeat;
  const repeatActive = repeatMode !== "off";

  const playbackStatus = audioError
    ? errorCountRef.current > MAX_AUTO_RETRIES
      ? "Playback failed. Skipping to the next track."
      : "Playback failed. Activate retry to try again."
    : isBusy
      ? isPreparing
        ? "Opening…"
        : "Buffering…"
      : "";

  return (
    <>
      {/* Audio element lives outside the conditional UI below so no render-time
          condition (page switch, loading flicker) can ever unmount it and kill
          playback. The UI shell renders as soon as a song is picked so the
          user sees Opening/Buffering states instead of a dead gap. */}
      <audio
        ref={audioRef}
        src={audioUrl || undefined}
        preload="auto"
        playsInline
        loop={repeatMode === "one"}
        onTimeUpdate={() => {
          const now = Date.now();
          if (now - lastPositionSaveRef.current > 5000) {
            lastPositionSaveRef.current = now;
            savePlaybackPosition();
            syncMediaPosition();
          }
        }}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onCanPlay={() => {
          if (audioSongId !== song?.id || activeSongIdRef.current !== song?.id) return;
          setIsBuffering(false);
          setAudioError(false);
          errorCountRef.current = 0;
          clearAutoAdvanceTimer();
          if (playRef.current) {
            playRef.current = false;
            audioRef.current?.play().catch(() => setIsPlaying(false));
            setIsPlaying(true);
          }
        }}
        onLoadedMetadata={() => {
          const resume = resumePositionRef.current;
          resumePositionRef.current = null;
          if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
            const total = audioRef.current.duration;
            setDuration(total);
            audioRef.current.playbackRate = playbackRate;
            if (resume && resume.songId === audioSongId && resume.position < total - 5) {
              audioRef.current.currentTime = resume.position;
            }
            syncMediaPosition();
          }
        }}
        onRateChange={syncMediaPosition}
        onError={() => {
          // An error from the previous source can arrive while the replacement
          // is still loading; reacting to it would cancel the new load.
          if (audioSongId !== song?.id || activeSongIdRef.current !== song?.id) return;
          const mediaError = audioRef.current?.error;
          console.error("Playback error:", {
            songId: song?.id,
            title: song?.title,
            src: audioUrl?.startsWith("blob:") ? "(offline cached copy)" : audioUrl,
            code: mediaError?.code,
          });
          // If the offline cached copy is unplayable, evict it once and fall
          // back to streaming the network URL instead of failing every retry.
          if (audioUrl?.startsWith("blob:") && publicUrlRef.current && !networkFallbackTriedRef.current) {
            networkFallbackTriedRef.current = true;
            setIsBuffering(true);
            evictCachedAudio(publicUrlRef.current).finally(() => {
              if (blobUrlRef.current) {
                URL.revokeObjectURL(blobUrlRef.current);
                blobUrlRef.current = null;
              }
              playRef.current = true;
              setAudioError(false);
              setAudioUrl(publicUrlRef.current);
            });
            return;
          }
          playRef.current = playRef.current || isPlayingRef.current;
          isPlayingRef.current = false;
          setIsPlaying(false);
          setIsBuffering(false);
          setAudioError(true);
          handlePlaybackError();
        }}
        onEnded={() => {
          playRef.current = false;
          try { localStorage.removeItem(PLAYBACK_POSITION_KEY); } catch {}
          advanceToNext({ reason: "ended" });
        }}
      />
      {song && (
        <>
          {/* Desktop player — full-width bar */}
      <div
        id="now-playing-bar"
        inert={showFullPlayer}
        aria-hidden={showFullPlayer}
        className="fixed bottom-14 left-0 right-0 z-[900] hidden min-[600px]:block md:bottom-0 cursor-pointer"
        onClick={openFullPlayer}
      >
        <div className="relative overflow-hidden border-t border-neutral-200 bg-white shadow-sm">
          <ThinProgress audioRef={audioRef} duration={duration} onSeek={handleSeek} />

          {/* Body */}
          <div className="relative z-10 px-6 h-[72px]">
            <div className="flex items-center h-full max-w-screen-2xl mx-auto gap-x-4">
              {/* Left — song info */}
              <div className="flex items-center gap-3 w-[180px] shrink-0 sm:w-[220px] md:w-[260px]">
                <SongAvatar title={song.title} size="sm" variant="mono" />
                <div className="min-w-0">
                  <button
                    type="button"
                    aria-label={`Open now playing: ${song.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      openFullPlayer();
                    }}
                    className="block w-full truncate text-left text-sm font-semibold tracking-tight text-neutral-900"
                  >
                    {song.title}
                  </button>
                  {isBusy ? (
                    <p className="truncate text-xs font-semibold text-accent">
                      {isPreparing ? "Opening…" : "Buffering…"}
                    </p>
                  ) : (
                    <p className="truncate text-xs font-medium text-neutral-400">
                      {song.author}
                    </p>
                  )}
                </div>
              </div>

              {/* Center — controls */}
              <div className="flex-1 flex flex-col items-center gap-0.5">
                <div className="flex items-center gap-x-1">
                  <button
                    type="button"
                    aria-label="Toggle shuffle"
                    aria-pressed={isShuffle}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsShuffle(!isShuffle);
                    }}
                    className={`rounded-full p-2 transition-colors active:scale-90 ${
                      isShuffle
                        ? "text-accent"
                        : "text-neutral-400 hover:text-neutral-900"
                    }`}
                  >
                    <Shuffle size={15} />
                  </button>

                  <button
                    type="button"
                    aria-label="Previous track"
                    onClick={(e) => { e.stopPropagation(); onPlayPrevious(); }}
                    className="rounded-full p-2 text-neutral-500 transition active:scale-90 hover:text-neutral-900"
                  >
                    <SkipBack size={17} fill="currentColor" />
                  </button>

                  <button
                    type="button"
                    aria-label={isBusy ? "Loading" : isPlaying ? "Pause" : "Play"}
                    onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                    className="mx-1.5 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white shadow-sm transition hover:bg-accent/90 active:scale-95"
                  >
                    {isBusy ? (
                      <BusySpinner size={18} />
                    ) : isPlaying ? (
                      <Pause size={20} fill="currentColor" />
                    ) : (
                      <Play size={20} fill="currentColor" className="ml-0.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    aria-label="Next track"
                    onClick={(e) => { e.stopPropagation(); onPlayNext(); }}
                    className="rounded-full p-2 text-neutral-500 transition active:scale-90 hover:text-neutral-900"
                  >
                    <SkipForward size={17} fill="currentColor" />
                  </button>

                  <button
                    type="button"
                    aria-label={REPEAT_LABELS[repeatMode]}
                    aria-pressed={repeatActive}
                    onClick={(e) => { e.stopPropagation(); cycleRepeat(); }}
                    className={`rounded-full p-2 transition-colors active:scale-90 ${
                      repeatActive
                        ? "text-accent"
                        : "text-neutral-400 hover:text-neutral-900"
                    }`}
                  >
                    <RepeatIcon size={15} />
                  </button>
                </div>
                <TimeReadout audioRef={audioRef} duration={duration} />
              </div>

              {/* Right — volume */}
              <div className="flex items-center justify-end gap-1 shrink-0 md:gap-2">
                <button
                  type="button"
                  aria-label={isLiked ? "Remove from saved songs" : "Save song"}
                  onClick={(e) => { e.stopPropagation(); toggleLike(); }}
                  className={`rounded-full p-2 transition ${
                    isLiked ? "text-accent" : "text-neutral-400 hover:text-accent"
                  }`}
                >
                  <Heart size={18} fill={isLiked ? "currentColor" : "none"} />
                </button>
                <button
                  type="button"
                  aria-label="Share this song"
                  onClick={handleShare}
                  className={`rounded-full p-2 transition ${
                    shareFeedback === "copied"
                      ? "text-green-600"
                      : shareFeedback === "failed"
                        ? "text-red-600"
                        : "text-neutral-400 hover:text-accent"
                  }`}
                >
                  {shareFeedback === "copied" ? (
                    <Check size={18} strokeWidth={3} />
                  ) : (
                    <Share2 size={18} />
                  )}
                </button>
                {/* Touch devices have hardware volume; a slider there is a
                    target that can't be hit accurately. */}
                <div className="hidden items-center gap-1 md:flex [@media(pointer:coarse)]:hidden">
                  <button
                    type="button"
                    aria-label={isMuted || volume === 0 ? "Unmute" : "Mute"}
                    onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                    className="rounded-full p-2 text-neutral-400 transition hover:text-accent"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX size={18} />
                    ) : (
                      <Volume size={18} />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    aria-label="Volume"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setVolume(v);
                      if (v > 0) setIsMuted(false);
                    }}
                    className="volume-slider w-20 lg:w-28"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile floating mini-player card */}
      <div
        inert={showFullPlayer}
        aria-hidden={showFullPlayer}
        className="fixed left-3 right-3 bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] z-[900] min-[600px]:hidden cursor-pointer rounded-2xl border border-neutral-200/90 bg-white/95 shadow-xl backdrop-blur-2xl overflow-hidden transition-all active:scale-[0.99]"
        onClick={openFullPlayer}
      >
        <ThinProgress
          audioRef={audioRef}
          duration={duration}
          onSeek={handleSeek}
          trackClassName="rounded-r-full"
        />
        <div className="flex items-center gap-3 px-3.5 py-2.5">
          <SongAvatar title={song.title} size="avatar-mini" variant="mono" />
          <div className="min-w-0 flex-1">
            <button
              type="button"
              aria-label={`Open now playing: ${song.title}`}
              onClick={(e) => {
                e.stopPropagation();
                openFullPlayer();
              }}
              className="block w-full truncate text-left text-sm font-semibold leading-tight tracking-tight text-neutral-900"
            >
              {song.title}
            </button>
            {isBusy ? (
              <p className="truncate text-xs font-semibold text-accent">
                {isPreparing ? "Opening…" : "Buffering…"}
              </p>
            ) : (
              <p className="truncate text-xs font-medium text-neutral-500">
                {song.author}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              aria-label="Previous track"
              onClick={(e) => { e.stopPropagation(); onPlayPrevious(); }}
              className="flex h-11 w-9 items-center justify-center rounded-full text-neutral-500 transition active:scale-90 hover:text-neutral-900"
            >
              <SkipBack size={14} fill="currentColor" />
            </button>
            <button
              type="button"
              aria-label={isBusy ? "Loading" : isPlaying ? "Pause" : "Play"}
              onClick={(e) => { e.stopPropagation(); togglePlay(); }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-md active:scale-90 transition hover:bg-accent/90"
            >
              {isBusy ? (
                <BusySpinner size={16} />
              ) : isPlaying ? (
                <Pause size={18} fill="currentColor" />
              ) : (
                <Play size={18} fill="currentColor" className="ml-0.5" />
              )}
            </button>
            <button
              type="button"
              aria-label="Next track"
              onClick={(e) => { e.stopPropagation(); onPlayNext(); }}
              className="flex h-11 w-9 items-center justify-center rounded-full text-neutral-500 transition active:scale-90 hover:text-neutral-900"
            >
              <SkipForward size={14} fill="currentColor" />
            </button>
            <button
              type="button"
              aria-label={isLiked ? "Remove from saved songs" : "Save song"}
              onClick={(e) => { e.stopPropagation(); toggleLike(); }}
              className={`flex h-11 w-9 items-center justify-center rounded-full transition ${
                isLiked ? "text-accent" : "text-neutral-400 hover:text-accent"
              }`}
            >
              <Heart size={16} fill={isLiked ? "currentColor" : "none"} />
            </button>
          </div>
        </div>
      </div>

      {/* Full-screen player overlay */}
      {showFullPlayer && (
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="player-title"
          className="fixed inset-0 z-[99999] flex flex-col animate-fade-in bg-white text-neutral-900"
        >
          {/* Atmospheric background glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-white via-neutral-50 to-neutral-100" />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent/[0.06] rounded-full blur-[100px] pointer-events-none" />

          {/* Swipe-down grabber */}
          <div
            aria-hidden="true"
            onPointerDown={onGrabberDown}
            onPointerUp={onGrabberUp}
            onPointerCancel={() => { swipeStartRef.current = null; }}
            className="relative z-10 flex h-7 shrink-0 touch-none items-center justify-center md:hidden"
          >
            <span className="h-1.5 w-10 rounded-full bg-neutral-300" />
          </div>

          {/* Header. Above the body columns so the overflow menu is not painted
              over by them — z-index inside a stacking context cannot escape it. */}
          <div className="relative z-30 flex shrink-0 items-center justify-between gap-1 px-3 pt-[env(safe-area-inset-top,0px)] pb-2 md:px-6 md:pt-4">
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Close player"
              onClick={closeFullPlayer}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200 transition"
            >
              <ChevronDown size={22} />
            </button>
            <div className="flex min-w-0 items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 border border-neutral-200">
              <span className="truncate text-xs font-bold uppercase tracking-widest text-neutral-500">
                {showQueue ? "Up Next" : "Now Playing"}
              </span>
            </div>
            <div className="flex shrink-0 items-center">
              <button
                type="button"
                aria-label="Share this song"
                onClick={handleShare}
                className={`flex h-11 w-11 items-center justify-center rounded-full transition hover:bg-neutral-100 ${
                  shareFeedback === "copied"
                    ? "text-green-600"
                    : shareFeedback === "failed"
                      ? "text-red-600"
                      : "text-neutral-500 hover:text-neutral-900"
                }`}
              >
                {shareFeedback === "copied" ? (
                  <Check size={18} strokeWidth={3} />
                ) : (
                  <Share2 size={18} />
                )}
              </button>
              <button
                type="button"
                aria-label={isLiked ? "Remove from saved songs" : "Save song"}
                aria-pressed={isLiked}
                onClick={toggleLike}
                className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
                  isLiked ? "text-white bg-accent" : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                }`}
              >
                <Heart size={18} fill={isLiked ? "currentColor" : "none"} />
              </button>
              <SongOverflowMenu
                song={song}
                playbackRate={playbackRate}
                onCyclePlaybackRate={cyclePlaybackRate}
                onStatus={announce}
                onOfflineChange={setIsOffline}
              />
            </div>
          </div>

          {shareFeedback && (
            <div className="pointer-events-none absolute inset-x-0 top-24 z-20 flex justify-center px-6">
              <span
                className={`rounded-full px-4 py-2 text-xs font-semibold shadow-lg ${
                  shareFeedback === "failed"
                    ? "bg-red-50 text-red-700"
                    : "bg-neutral-900 text-white"
                }`}
              >
                {shareFeedback === "copied"
                  ? "Link copied"
                  : "Couldn't share — copy the link from your address bar"}
              </span>
            </div>
          )}

          <div className="relative z-10 flex min-h-0 flex-1 flex-col md:flex-row">
            {/* Left column: artwork or queue */}
            <div className="flex min-h-0 flex-1 flex-col px-5 py-2 md:basis-[45%] md:flex-none md:border-r md:border-neutral-200 md:px-8 md:py-6">
              {showQueue ? (
                <PlayerQueue
                  songs={songs}
                  currentSongId={song.id}
                  isPlaying={isPlaying}
                  editable={queueEditable}
                  onSelect={(picked) => onSongSelect(picked, songs)}
                  onPlayNext={addToQueueNext}
                  onRemove={removeFromQueue}
                  onMove={moveInQueue}
                  onClear={clearQueue}
                />
              ) : (
                <div className="flex flex-1 items-center justify-center">
                  <VinylArtwork title={song.title} isPlaying={isPlaying} />
                </div>
              )}
            </div>

            {/* Right column: song info and controls */}
            <div className="relative z-10 flex shrink-0 flex-col md:min-h-0 md:flex-1 md:justify-center">
              <div className="px-6 pb-2 md:px-12 md:text-center lg:px-16">
                <h2
                  id="player-title"
                  className="text-xl font-bold tracking-tight text-neutral-900 md:text-2xl"
                >
                  {song.title}
                </h2>
                <p className="mt-1 text-sm font-medium text-neutral-500 md:text-base">
                  {song.author}
                </p>
                {attribution && (
                  <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                    {song.copyright_holder && <>© {song.copyright_holder}</>}
                    {song.copyright_holder && song.license_type && " · "}
                    {song.license_type &&
                      (song.license_url ? (
                        <a
                          href={song.license_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline transition hover:text-neutral-600"
                        >
                          {song.license_type}
                        </a>
                      ) : (
                        song.license_type
                      ))}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-2 md:justify-center">
                  {isOffline && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-500">
                      <Download size={10} />
                      Available offline
                    </span>
                  )}
                  {isBusy && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-600">
                      <BusySpinner size={12} />
                      {isPreparing ? "Opening…" : "Buffering…"}
                    </span>
                  )}
                </div>
                {audioError && (
                  <button
                    type="button"
                    onClick={retryPlayback}
                    className="mt-3 flex items-center gap-2 rounded-full bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-700 md:mx-auto"
                  >
                    <AlertTriangle size={14} />
                    {errorCountRef.current > MAX_AUTO_RETRIES
                      ? "Skipping to next track..."
                      : "Playback failed — Tap to retry"}
                  </button>
                )}
              </div>

              {/* Controls panel */}
              <div className="rounded-t-2xl border-t border-neutral-200 bg-white/80 px-5 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] backdrop-blur-2xl md:rounded-none md:border-t-0 md:bg-transparent md:px-12 md:pb-8 md:backdrop-blur-none lg:px-16">
                <SeekBar audioRef={audioRef} duration={duration} onSeek={handleSeek} />

                <div className="flex items-center justify-center gap-4 py-2 sm:gap-6">
                  <button
                    type="button"
                    aria-label="Toggle shuffle"
                    aria-pressed={isShuffle}
                    onClick={() => setIsShuffle(!isShuffle)}
                    className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
                      isShuffle ? "text-white bg-accent" : "text-neutral-500 hover:text-neutral-900"
                    }`}
                  >
                    <Shuffle size={18} />
                  </button>

                  <button
                    type="button"
                    aria-label="Previous track"
                    onClick={onPlayPrevious}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-600 transition active:scale-90 hover:text-neutral-900"
                  >
                    <SkipBack size={26} fill="currentColor" />
                  </button>

                  <button
                    type="button"
                    aria-label={isBusy ? "Loading" : isPlaying ? "Pause" : "Play"}
                    onClick={togglePlay}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-white shadow-xl transition active:scale-95 hover:bg-accent/90 hover:scale-105"
                  >
                    {isBusy ? (
                      <BusySpinner size={26} />
                    ) : isPlaying ? (
                      <Pause size={28} fill="currentColor" />
                    ) : (
                      <Play size={28} fill="currentColor" className="ml-1" />
                    )}
                  </button>

                  <button
                    type="button"
                    aria-label="Next track"
                    onClick={onPlayNext}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-600 transition active:scale-90 hover:text-neutral-900"
                  >
                    <SkipForward size={26} fill="currentColor" />
                  </button>

                  <button
                    type="button"
                    aria-label={REPEAT_LABELS[repeatMode]}
                    aria-pressed={repeatActive}
                    onClick={cycleRepeat}
                    className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
                      repeatActive ? "text-white bg-accent" : "text-neutral-500 hover:text-neutral-900"
                    }`}
                  >
                    <RepeatIcon size={18} />
                  </button>
                </div>

                {/* Bottom utilities. Volume gets its own row on phones so the
                    slider is always reachable; from sm up everything sits on
                    one row. */}
                <div className="mx-auto flex max-w-md flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between sm:gap-1.5">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      aria-label={isMuted || volume === 0 ? "Unmute" : "Mute"}
                      onClick={toggleMute}
                      className="flex h-11 w-9 items-center justify-center rounded-full text-neutral-500 transition hover:text-neutral-900"
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX size={17} />
                      ) : (
                        <Volume size={17} />
                      )}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      aria-label="Volume"
                      aria-valuetext={`${Math.round((isMuted ? 0 : volume) * 100)}%`}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setVolume(v);
                        if (v > 0) setIsMuted(false);
                      }}
                      className="volume-slider w-32 sm:w-20 lg:w-24"
                    />
                  </div>

                  <div className="flex items-center justify-center gap-1.5">
                    <SleepTimerControl />
                    <button
                      type="button"
                      aria-label={showQueue ? "Show artwork" : "Show queue"}
                      aria-pressed={showQueue}
                      onClick={() => setShowQueue(!showQueue)}
                      className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${
                        showQueue ? "bg-accent text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                      }`}
                    >
                      <ListMusic size={15} />
                      <span>{showQueue ? "Artwork" : "Queue"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
        </>
      )}
      <p aria-live="polite" role="status" className="sr-only">
        {liveMessage || playbackStatus}
      </p>
    </>
  );
};

export default Player;