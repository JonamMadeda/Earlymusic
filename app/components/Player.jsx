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
} from "lucide-react";
import { getCachedAudioUrl, cacheAudioFile } from "@/lib/cacheUtils";
import SongAvatar, { pastelGradient, gradientFirstColor, initialLetter } from "./SongAvatar";
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
  const [audioError, setAudioError] = useState(false);

  const { user } = useAuth();

  const currentIndex = (songs || []).findIndex((s) => s.id === song?.id);

  const playRef = useRef(false);
  const loadIdRef = useRef(0);
  const isPlayingRef = useRef(false);
  const skipWhilePausedRef = useRef(false);
  const scrubbingRef = useRef(false);
  const blobUrlRef = useRef(null);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

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

  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator) || !song) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: song.author,
      album: "Early Music",
      artwork: [
        { src: "/favicon.ico", sizes: "192x192", type: "image/png" },
      ],
    });

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
  }, [song, setPlayState, onPlayNext, onPlayPrevious]);

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
        <div className="relative overflow-hidden border-t border-white/60 bg-white/80 backdrop-blur-2xl shadow-lg shadow-neutral-900/5">
          {/* Song-tinted gradient overlay */}
          <div className="absolute inset-0 opacity-[0.06]" style={{ background: pastelGradient(song?.title || "default") }} />

          {/* Progress bar */}
          <div className="relative z-10 h-1 bg-neutral-100/60 group">
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
              className="h-full transition-all duration-150"
              style={{ width: `${progress}%`, background: pastelGradient(song?.title || "default") }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-none"
              style={{ left: `${progress}%`, marginLeft: '-7px', background: pastelGradient(song?.title || "default") }}
            />
          </div>

          {/* Body */}
          <div className="relative z-10 px-6 h-[72px]">
            <div className="flex items-center h-full max-w-screen-2xl mx-auto gap-x-4">
              {/* Left — song info */}
              <div className="flex items-center gap-3 w-[260px] shrink-0">
                <SongAvatar title={song.title} size="sm" />
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
                    className="mx-1.5 flex h-10 w-10 items-center justify-center rounded-full text-white shadow-[0_0_14px_-2px] transition hover:brightness-110 active:scale-95"
                    style={{ background: pastelGradient(song?.title || "default"), boxShadow: `0 0 14px -2px ${gradientFirstColor(song?.title || "default")}80` }}
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
                  className="h-1 w-20 lg:w-28 cursor-pointer appearance-none rounded-full bg-neutral-200"
                  style={{ accentColor: gradientFirstColor(song?.title || "default") }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile mini-bar */}
      <div
        className="fixed bottom-14 left-0 right-0 z-[900] md:hidden cursor-pointer shadow-lg shadow-neutral-900/5"
        onClick={() => setShowFullPlayer(true)}
      >
        {/* Mini progress bar */}
        <div className="h-0.5 bg-neutral-100">
          <div className="h-full transition-all duration-150" style={{ width: `${progress}%`, background: pastelGradient(song?.title || "default") }} />
        </div>
        <div className="flex items-center gap-3 border-t border-white/70 bg-white/95 backdrop-blur-2xl px-3 py-2.5 active:bg-neutral-50/50">
          <SongAvatar title={song.title} size="avatar-mini" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold tracking-tight text-neutral-900">
              {song.title}
            </p>
            <p className="truncate text-[10px] font-medium text-neutral-400">
              {song.author}
            </p>
          </div>
          <button
            type="button"
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-md active:scale-90 transition hover:brightness-110"
            style={{ background: pastelGradient(song?.title || "default"), boxShadow: `0 4px 6px -1px ${gradientFirstColor(song?.title || "default")}40` }}
          >
            {isPlaying ? (
              <Pause size={15} fill="currentColor" />
            ) : (
              <Play size={15} fill="currentColor" className="ml-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* Full-screen player overlay */}
      {showFullPlayer && (
        <div className="fixed inset-0 z-[99999] flex flex-col animate-fade-in">
          {/* Full-bleed gradient background */}
          <div className="absolute inset-0" style={{ background: pastelGradient(song.title || "") }} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-black/60" />

          {/* Header */}
          <div className="relative z-10 flex items-center justify-between px-5 pt-5 pb-2 md:px-8">
            <button
              type="button"
              aria-label="Close player"
              onClick={() => {
                setShowFullPlayer(false);
                window.history.back();
              }}
              className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-white/60 hover:text-white/80 transition"
            >
              <ChevronDown size={20} />
            </button>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
              Now Playing
            </span>
            <button
              type="button"
              aria-label={isLiked ? "Remove from saved songs" : "Save song"}
              onClick={toggleLike}
              className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                isLiked ? "text-white bg-white/15" : "text-white/50 hover:text-white hover:bg-white/10"
              }`}
            >
              <Heart size={18} fill={isLiked ? "currentColor" : "none"} />
            </button>
          </div>

          {/* Content area — mobile: stacked, desktop: side-by-side */}
          <div className="relative z-10 flex flex-1 items-center justify-center px-6 md:px-12 lg:px-20">
            {/* Artwork — large initial letter */}
            <div className="flex items-center justify-center">
              <span className={`font-bold leading-none text-white/90 drop-shadow-xl select-none ${
                initialLetter(song.title) === "M" || initialLetter(song.title) === "W"
                  ? "text-[120px] md:text-[200px] lg:text-[260px]"
                  : "text-[140px] md:text-[220px] lg:text-[280px]"
              }`}>
                {initialLetter(song.title)}
              </span>
            </div>
          </div>

          {/* Song info */}
          <div className="relative z-10 px-6 pb-3 md:px-12 lg:px-20 md:text-center">
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
                Playback failed — Tap to retry
              </button>
            )}
          </div>

          {/* Glass-morphism controls panel */}
          <div className="relative z-10 rounded-t-3xl bg-white/10 backdrop-blur-2xl border-t border-white/20 px-5 pt-4 pb-8 md:px-12 lg:px-20">
            {/* Seek bar */}
            <div className="mb-1">
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onPointerDown={() => { scrubbingRef.current = true; }}
                onPointerUp={() => { scrubbingRef.current = false; }}
                onChange={(e) => handleSeek(Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-white [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md"
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] font-medium tabular-nums text-white/60">
                  {formatTime(currentTime)}
                </span>
                <span className="text-[10px] font-medium tabular-nums text-white/60">
                  -{formatTime(Math.max(0, duration - currentTime))}
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-5 py-3">
              <button
                type="button"
                aria-label="Toggle shuffle"
                onClick={() => {
                  const newState = !isShuffle;
                  setIsShuffle(newState);
                  if (newState) setIsLooping(false);
                }}
                className={`rounded-full p-1.5 transition-colors ${
                  isShuffle ? "text-white" : "text-white/50"
                }`}
              >
                <Shuffle size={18} />
              </button>

              <button
                type="button"
                aria-label="Previous track"
                onClick={onPlayPrevious}
                className="rounded-full p-1.5 text-white/70 transition active:scale-90"
              >
                <SkipBack size={24} fill="currentColor" />
              </button>

              <button
                type="button"
                aria-label={isPlaying ? "Pause" : "Play"}
                onClick={togglePlay}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-neutral-900 shadow-xl transition active:scale-95"
              >
                {isPlaying ? (
                  <Pause size={26} fill="currentColor" />
                ) : (
                  <Play size={26} fill="currentColor" className="ml-1" />
                )}
              </button>

              <button
                type="button"
                aria-label="Next track"
                onClick={onPlayNext}
                className="rounded-full p-1.5 text-white/70 transition active:scale-90"
              >
                <SkipForward size={24} fill="currentColor" />
              </button>

              <button
                type="button"
                aria-label="Toggle repeat"
                onClick={() => {
                  const newState = !isLooping;
                  setIsLooping(newState);
                  if (newState) setIsShuffle(false);
                }}
                className={`rounded-full p-1.5 transition-colors ${
                  isLooping ? "text-white" : "text-white/50"
                }`}
              >
                <Repeat size={18} />
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                type="button"
                aria-label={isMuted || volume === 0 ? "Unmute" : "Mute"}
                onClick={toggleMute}
                className="rounded-full p-1 text-white/50"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX size={16} />
                ) : (
                  <Volume size={16} />
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
                className="h-1 w-32 cursor-pointer appearance-none rounded-full bg-white/20 accent-white"
              />
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