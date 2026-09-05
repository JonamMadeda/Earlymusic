"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getAudioPublicUrl } from "@/lib/audioUrl";
import { usePlayer } from "../context/PlayerContext";
import {
  Play,
  Pause,
  Volume,
  VolumeX,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  ChevronDown,
  Heart,
  AlertTriangle,
  ListMusic,
} from "lucide-react";
import { getCachedAudioUrl, cacheAudioFile } from "@/lib/cacheUtils";
import SongAvatar, { initialLetter, VinylArtwork } from "./SongAvatar";
import { useAuth } from "../context/AuthContext";

const Player = () => {
  const audioRef = useRef(null);
  const {
    activeSong: song,
    queue: songs,
    setActiveSong: onSongSelect,
  } = usePlayer();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [audioUrl, setAudioUrl] = useState(null);
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [audioError, setAudioError] = useState(false);

  const { user } = useAuth();

  const currentIndex = (songs || []).findIndex((s) => s.id === song?.id);

  const playRef = useRef(false);
  const loadIdRef = useRef(0);
  const isPlayingRef = useRef(false);
  const skipWhilePausedRef = useRef(false);
  const scrubbingRef = useRef(false);
  const blobUrlRef = useRef(null);
  const wakeLockRef = useRef(null);
  const errorCountRef = useRef(0);
  const autoAdvanceTimerRef = useRef(null);
  const MAX_AUTO_RETRIES = 3;
  const AUTO_ADVANCE_DELAY = 3000;

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // --- Wake Lock: keep screen on during playback on mobile ---
  const requestWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        wakeLockRef.current.addEventListener("release", () => {
          wakeLockRef.current = null;
        });
      }
    } catch {
      // Wake Lock not supported or denied — silently ignore
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch {
      // ignore
    }
  }, []);

  // Acquire/release wake lock based on play state
  useEffect(() => {
    if (isPlaying) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
  }, [isPlaying, requestWakeLock, releaseWakeLock]);

  // Re-acquire wake lock when page becomes visible again (mobile browsers
  // often release it when the tab is backgrounded)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isPlayingRef.current) {
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [requestWakeLock]);

  // --- Auto-advance on playback error ---
  const clearAutoAdvanceTimer = useCallback(() => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  // Release wake lock & timers on unmount
  useEffect(() => {
    return () => {
      releaseWakeLock();
      clearAutoAdvanceTimer();
    };
  }, [releaseWakeLock, clearAutoAdvanceTimer]);

  // Reset error count when the song changes
  useEffect(() => {
    errorCountRef.current = 0;
    clearAutoAdvanceTimer();
  }, [song?.id, clearAutoAdvanceTimer]);

  useEffect(() => {
    if (!user || !song) {
      setIsLiked(false);
      return;
    }
    const songId = song.id;
    supabase
      .from("saved_songs")
      .select("id")
      .eq("user_id", user.id)
      .eq("song_id", song.id)
      .maybeSingle()
      .then(({ data }) => {
        if (songId === song?.id) setIsLiked(!!data);
      })
      .catch((error) => console.error("Unable to check saved song:", error));
  }, [user, song?.id]);

  const toggleLike = async () => {
    if (!user || !song) return;
    const songId = song.id;
    try {
      if (isLiked) {
        const { error } = await supabase
          .from("saved_songs")
          .delete()
          .eq("user_id", user.id)
          .eq("song_id", song.id);
        if (error) throw error;
        if (songId === song?.id) setIsLiked(false);
      } else {
        const { error } = await supabase
          .from("saved_songs")
          .insert({ user_id: user.id, song_id: song.id });
        if (error) throw error;
        if (songId === song?.id) setIsLiked(true);
      }
    } catch (error) {
      console.error("Unable to update saved song:", error);
    }
  };

  // Mobile back button closes full-screen player instead of leaving the app
  useEffect(() => {
    if (!showFullPlayer) return;

    window.history.pushState(null, "", window.location.href);

    const handlePopState = () => setShowFullPlayer(false);

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
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

  const selectNextSong = useCallback(() => {
    if (!songs || songs.length === 0) return null;
    skipWhilePausedRef.current = !isPlayingRef.current;

    let nextIndex;
    if (isShuffle) {
      nextIndex = currentIndex;
      if (songs.length > 1) {
        while (nextIndex === currentIndex) {
          nextIndex = Math.floor(Math.random() * songs.length);
        }
      }
    } else {
      nextIndex = (currentIndex + 1) % songs.length;
    }
    return songs[nextIndex];
  }, [songs, isShuffle, currentIndex]);

  const onPlayNext = useCallback(() => {
    const nextSong = selectNextSong();
    if (nextSong) onSongSelect(nextSong, songs);
  }, [selectNextSong, songs, onSongSelect]);

  const onPlayPrevious = useCallback(() => {
    if (!songs || songs.length === 0) return;
    skipWhilePausedRef.current = !isPlayingRef.current;
    const prevIndex = currentIndex <= 0 ? songs.length - 1 : currentIndex - 1;
    onSongSelect(songs[prevIndex], songs);
  }, [songs, currentIndex, onSongSelect]);

  const setPlayState = useCallback((playing) => {
    setIsPlaying(playing);
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handlePlaybackError = useCallback(() => {
    clearAutoAdvanceTimer();
    errorCountRef.current += 1;

    if (errorCountRef.current <= MAX_AUTO_RETRIES) {
      const retryDelay = 1000 * errorCountRef.current;
      autoAdvanceTimerRef.current = setTimeout(() => {
        if (audioRef.current && errorCountRef.current <= MAX_AUTO_RETRIES) {
          audioRef.current.load();
        }
      }, retryDelay);
    } else {
      autoAdvanceTimerRef.current = setTimeout(() => {
        clearAutoAdvanceTimer();
        errorCountRef.current = 0;
        onPlayNext();
      }, AUTO_ADVANCE_DELAY);
    }
  }, [clearAutoAdvanceTimer, onPlayNext]);

  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator) || !song) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: song.author,
      album: "Lumbo",
      artwork: [
        { src: "/favicon.ico", sizes: "192x192", type: "image/png" },
      ],
    });

    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";

    navigator.mediaSession.setActionHandler("play", () => setPlayState(true));
    navigator.mediaSession.setActionHandler("pause", () => setPlayState(false));
    navigator.mediaSession.setActionHandler("previoustrack", onPlayPrevious);
    navigator.mediaSession.setActionHandler("nexttrack", onPlayNext);

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
    };
  }, [song, isPlaying, setPlayState, onPlayNext, onPlayPrevious]);

  useEffect(() => {
    if (!song) return;

    const loadId = ++loadIdRef.current;
    let cancelled = false;

    const loadAudio = async () => {
      setAudioError(false);
      setDuration(0);
      setCurrentTime(0);

      try {
        const publicUrl = getAudioPublicUrl(song.song_path);

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
          cacheAudioFile(publicUrl, song.song_path);
        }

        playRef.current = !skipWhilePausedRef.current;
        skipWhilePausedRef.current = false;
      } catch (error) {
        console.error("Unable to load audio:", error);
        if (!cancelled && loadId === loadIdRef.current) {
          setAudioError(true);
          playRef.current = false;
        }
      }
    };

    loadAudio();

    return () => {
      cancelled = true;
    };
  }, [song]);

  // Eager attempt to play as soon as the audio URL is set
  useEffect(() => {
    if (!audioUrl || !audioRef.current || !playRef.current) return;

    audioRef.current.play().then(() => {
      setIsPlaying(true);
      playRef.current = false;
    }).catch(() => {
      playRef.current = false;
      setIsPlaying(false);
    });
  }, [audioUrl]);

  const retryPlayback = () => {
    if (!song) return;
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

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (audioRef.current) audioRef.current.muted = newMuted;
  };

  const formatTime = (time) => {
    if (!Number.isFinite(time) || time < 0) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const handleSeek = (time) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
    scrubbingRef.current = false;
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;

  if (!song || !audioUrl) return null;

  return (
    <>
      {/* Desktop player — full-width bar */}
      <div
        className="fixed bottom-14 left-0 right-0 z-[900] hidden md:block md:bottom-0 cursor-pointer"
        onClick={() => setShowFullPlayer(true)}
      >
        <div className="relative overflow-hidden border-t border-neutral-200 bg-white shadow-sm">
          {/* Progress bar */}
          <div className="relative z-10 h-1 bg-neutral-100 group">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onPointerDown={() => { scrubbingRef.current = true; }}
              onPointerUp={() => { scrubbingRef.current = false; }}
              onChange={(e) => handleSeek(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            />
            <div
              className="h-full transition-all duration-150 bg-accent"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-white bg-accent shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-none"
              style={{ left: `${progress}%`, marginLeft: '-7px' }}
            />
          </div>

          {/* Body */}
          <div className="relative z-10 px-6 h-[72px]">
            <div className="flex items-center h-full max-w-screen-2xl mx-auto gap-x-4">
              {/* Left — song info */}
              <div className="flex items-center gap-3 w-[260px] shrink-0">
                <SongAvatar title={song.title} size="sm" variant="mono" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tracking-tight text-neutral-900">
                    {song.title}
                  </p>
                  <p className="truncate text-[11px] font-medium text-neutral-400">
                    {song.author}
                  </p>
                </div>
              </div>

              {/* Center — controls */}
              <div className="flex-1 flex flex-col items-center gap-0.5">
                <div className="flex items-center gap-x-1">
                  <button
                    type="button"
                    aria-label="Toggle shuffle"
                    onClick={(e) => {
                      e.stopPropagation();
                      const newState = !isShuffle;
                      setIsShuffle(newState);
                      if (newState) setIsLooping(false);
                    }}
                    className={`rounded-full p-1.5 transition-colors active:scale-90 ${
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
                    className="rounded-full p-1.5 text-neutral-500 transition active:scale-90 hover:text-neutral-900"
                  >
                    <SkipBack size={17} fill="currentColor" />
                  </button>

                  <button
                    type="button"
                    aria-label={isPlaying ? "Pause" : "Play"}
                    onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                    className="mx-1.5 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white shadow-sm transition hover:bg-accent/90 active:scale-95"
                  >
                    {isPlaying ? (
                      <Pause size={20} fill="currentColor" />
                    ) : (
                      <Play size={20} fill="currentColor" className="ml-0.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    aria-label="Next track"
                    onClick={(e) => { e.stopPropagation(); onPlayNext(); }}
                    className="rounded-full p-1.5 text-neutral-500 transition active:scale-90 hover:text-neutral-900"
                  >
                    <SkipForward size={17} fill="currentColor" />
                  </button>

                  <button
                    type="button"
                    aria-label="Toggle repeat"
                    onClick={(e) => {
                      e.stopPropagation();
                      const newState = !isLooping;
                      setIsLooping(newState);
                      if (newState) setIsShuffle(false);
                    }}
                    className={`rounded-full p-1.5 transition-colors active:scale-90 ${
                      isLooping
                        ? "text-accent"
                        : "text-neutral-400 hover:text-neutral-900"
                    }`}
                  >
                    <Repeat size={15} />
                  </button>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-medium tabular-nums text-neutral-400">
                  <span>{formatTime(currentTime)}</span>
                  <span className="text-neutral-300">/</span>
                  <span>-{formatTime(Math.max(0, duration - currentTime))}</span>
                </div>
              </div>

              {/* Right — volume */}
              <div className="flex items-center justify-end gap-3 w-[260px] shrink-0">
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
                    if (audioRef.current) audioRef.current.volume = v;
                    if (v > 0) setIsMuted(false);
                  }}
                  className="h-1 w-20 lg:w-28 cursor-pointer appearance-none rounded-full bg-neutral-200 accent-accent"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile floating mini-player card */}
      <div
        className="fixed left-3 right-3 bottom-[calc(3.75rem+env(safe-area-inset-bottom,0px))] z-[900] md:hidden cursor-pointer rounded-2xl border border-neutral-200/90 bg-white/95 shadow-xl backdrop-blur-2xl overflow-hidden transition-all active:scale-[0.99]"
        onClick={() => setShowFullPlayer(true)}
      >
        {/* Mini progress bar */}
        <div className="h-1 bg-neutral-100/90">
          <div className="h-full transition-all duration-150 bg-accent rounded-r-full" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center gap-3 px-3.5 py-2.5">
          <SongAvatar title={song.title} size="avatar-mini" variant="mono" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight text-neutral-900 leading-tight">
              {song.title}
            </p>
            <p className="truncate text-xs font-medium text-neutral-500">
              {song.author}
            </p>
          </div>
          <button
            type="button"
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-md active:scale-90 transition hover:bg-accent/90"
          >
            {isPlaying ? (
              <Pause size={18} fill="currentColor" />
            ) : (
              <Play size={18} fill="currentColor" className="ml-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* Full-screen player overlay */}
      {showFullPlayer && (
        <div className="fixed inset-0 z-[99999] flex flex-col animate-fade-in bg-[#0b1120] text-white">
          {/* Atmospheric background glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a] via-[#0b1120] to-black opacity-95" />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent/20 rounded-full blur-[100px] pointer-events-none" />

          {/* Header */}
          <div className="relative z-10 flex items-center justify-between px-5 pt-5 pb-2 md:px-8">
            <button
              type="button"
              aria-label="Close player"
              onClick={() => {
                setShowFullPlayer(false);
                window.history.back();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 hover:text-white hover:bg-white/20 transition"
            >
              <ChevronDown size={22} />
            </button>
            <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 border border-white/10">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                {showQueue ? "Up Next" : "Now Playing"}
              </span>
            </div>
            <button
              type="button"
              aria-label={isLiked ? "Remove from saved songs" : "Save song"}
              onClick={toggleLike}
              className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                isLiked ? "text-white bg-white/20" : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              <Heart size={18} fill={isLiked ? "currentColor" : "none"} />
            </button>
          </div>

          {/* Center Content: Vinyl Artwork OR Up Next Queue */}
          {showQueue ? (
            <div className="relative z-10 flex flex-1 flex-col w-full max-w-lg mx-auto overflow-hidden px-5 py-2">
              <div className="flex items-center justify-between pb-2.5 border-b border-white/10 mb-2">
                <span className="text-xs font-bold tracking-wider text-white/80 uppercase">
                  Queue ({songs?.length || 0})
                </span>
                <span className="text-[11px] text-white/40">Tap any song to play</span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                {(songs || []).map((s, idx) => {
                  const isCurrent = s.id === song?.id;
                  return (
                    <button
                      key={s.id || idx}
                      type="button"
                      onClick={() => onSongSelect(s, songs)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition ${
                        isCurrent
                          ? "bg-white/15 text-white font-semibold border border-white/20 shadow-sm"
                          : "hover:bg-white/10 text-white/80"
                      }`}
                    >
                      <span className="text-xs text-white/40 w-5 text-center shrink-0">{idx + 1}</span>
                      <SongAvatar title={s.title} size="sm" variant="mono" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-white">{s.title}</p>
                        <p className="truncate text-[11px] text-white/60">{s.author}</p>
                      </div>
                      {isCurrent && isPlaying && (
                        <div className="waveform text-white flex h-3.5 items-center"><span /><span /><span /><span /></div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="relative z-10 flex flex-1 items-center justify-center px-6">
              <VinylArtwork title={song.title} isPlaying={isPlaying} />
            </div>
          )}

          {/* Song info */}
          <div className="relative z-10 px-6 pb-2 md:px-12 lg:px-20 md:text-center">
            <h2 className="text-xl font-bold tracking-tight text-white drop-shadow-sm md:text-2xl">
              {song.title}
            </h2>
            <p className="mt-1 text-sm font-medium text-white/70 md:text-base">
              {song.author}
            </p>
            {audioError && (
              <button
                type="button"
                onClick={retryPlayback}
                className="mt-3 flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-semibold text-white backdrop-blur-sm"
              >
                <AlertTriangle size={14} />
                {errorCountRef.current > MAX_AUTO_RETRIES
                  ? "Skipping to next track..."
                  : "Playback failed — Tap to retry"}
              </button>
            )}
          </div>

          {/* Glass-morphism controls panel */}
          <div className="relative z-10 rounded-t-3xl bg-white/[0.08] backdrop-blur-2xl border-t border-white/15 px-5 pt-4 pb-8 md:px-12 lg:px-20">
            {/* Seek bar */}
            <div className="mb-2">
              <div className="relative flex items-center py-2">
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onPointerDown={() => { scrubbingRef.current = true; }}
                  onPointerUp={() => { scrubbingRef.current = false; }}
                  onChange={(e) => handleSeek(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-white [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium tabular-nums text-white/60">
                  {formatTime(currentTime)}
                </span>
                <span className="text-xs font-medium tabular-nums text-white/60">
                  -{formatTime(Math.max(0, duration - currentTime))}
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-5 sm:gap-7 py-2">
              <button
                type="button"
                aria-label="Toggle shuffle"
                onClick={() => {
                  const newState = !isShuffle;
                  setIsShuffle(newState);
                  if (newState) setIsLooping(false);
                }}
                className={`rounded-full p-2.5 transition-colors ${
                  isShuffle ? "text-white bg-white/20" : "text-white/50 hover:text-white"
                }`}
              >
                <Shuffle size={18} />
              </button>

              <button
                type="button"
                aria-label="Previous track"
                onClick={onPlayPrevious}
                className="rounded-full p-2 text-white/80 transition active:scale-90 hover:text-white"
              >
                <SkipBack size={26} fill="currentColor" />
              </button>

              <button
                type="button"
                aria-label={isPlaying ? "Pause" : "Play"}
                onClick={togglePlay}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-neutral-900 shadow-xl transition active:scale-95 hover:scale-105"
              >
                {isPlaying ? (
                  <Pause size={28} fill="currentColor" />
                ) : (
                  <Play size={28} fill="currentColor" className="ml-1" />
                )}
              </button>

              <button
                type="button"
                aria-label="Next track"
                onClick={onPlayNext}
                className="rounded-full p-2 text-white/80 transition active:scale-90 hover:text-white"
              >
                <SkipForward size={26} fill="currentColor" />
              </button>

              <button
                type="button"
                aria-label="Toggle repeat"
                onClick={() => {
                  const newState = !isLooping;
                  setIsLooping(newState);
                  if (newState) setIsShuffle(false);
                }}
                className={`rounded-full p-2.5 transition-colors ${
                  isLooping ? "text-white bg-white/20" : "text-white/50 hover:text-white"
                }`}
              >
                <Repeat size={18} />
              </button>
            </div>

            {/* Bottom utilities: Volume & Queue toggle */}
            <div className="flex items-center justify-between pt-2 max-w-sm mx-auto">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  aria-label={isMuted || volume === 0 ? "Unmute" : "Mute"}
                  onClick={toggleMute}
                  className="rounded-full p-1.5 text-white/60 hover:text-white transition"
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
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setVolume(v);
                    if (audioRef.current) audioRef.current.volume = v;
                    if (v > 0) setIsMuted(false);
                  }}
                  className="h-1.5 w-24 sm:w-28 cursor-pointer appearance-none rounded-full bg-white/20 accent-white"
                />
              </div>

              <button
                type="button"
                aria-label={showQueue ? "Show artwork" : "Show queue"}
                onClick={() => setShowQueue(!showQueue)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  showQueue ? "bg-white text-neutral-900" : "bg-white/10 text-white/80 hover:bg-white/20"
                }`}
              >
                <ListMusic size={15} />
                <span>{showQueue ? "Artwork" : "Queue"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <audio
        ref={audioRef}
        src={audioUrl}
        loop={isLooping}
        onTimeUpdate={() => {
          if (audioRef.current && !scrubbingRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }}
        onCanPlay={() => {
          if (playRef.current) {
            playRef.current = false;
            audioRef.current?.play().catch(() => setIsPlaying(false));
            setIsPlaying(true);
            errorCountRef.current = 0;
            clearAutoAdvanceTimer();
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
            setDuration(audioRef.current.duration);
          }
        }}
        onError={() => {
          playRef.current = false;
          setIsPlaying(false);
          setAudioError(true);
          handlePlaybackError();
        }}
        onEnded={() => {
          playRef.current = false;
          onPlayNext();
        }}
      />
    </>
  );
};

export default Player;