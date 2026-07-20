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
} from "lucide-react";
import { getCachedAudioUrl, cacheAudioFile } from "@/lib/cacheUtils";
import SongAvatar, { pastelGradient, gradientFirstColor, initialLetter } from "./SongAvatar";

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
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [audioUrl, setAudioUrl] = useState(null);
  const [showFullPlayer, setShowFullPlayer] = useState(false);

  const currentIndex = (songs || []).findIndex((s) => s.id === song?.id);

  const playRef = useRef(false);

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

  const onPlayNext = useCallback(() => {
    if (!songs || songs.length === 0) return;

    if (isShuffle) {
      let nextIndex = currentIndex;
      if (songs.length > 1) {
        while (nextIndex === currentIndex) {
          nextIndex = Math.floor(Math.random() * songs.length);
        }
      }
      onSongSelect(songs[nextIndex], songs);
    } else {
      const nextIndex = (currentIndex + 1) % songs.length;
      onSongSelect(songs[nextIndex], songs);
    }
  }, [songs, isShuffle, currentIndex, onSongSelect]);

  const onPlayPrevious = useCallback(() => {
    if (!songs || songs.length === 0) return;
    const prevIndex = currentIndex <= 0 ? songs.length - 1 : currentIndex - 1;
    onSongSelect(songs[prevIndex], songs);
  }, [songs, currentIndex, onSongSelect]);

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

    navigator.mediaSession.setActionHandler("play", togglePlay);
    navigator.mediaSession.setActionHandler("pause", togglePlay);
    navigator.mediaSession.setActionHandler("previoustrack", onPlayPrevious);
    navigator.mediaSession.setActionHandler("nexttrack", onPlayNext);

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
    };
  }, [song, togglePlay, onPlayNext, onPlayPrevious]);

  useEffect(() => {
    if (song) {
      const loadAudio = async () => {
        const publicUrl = getAudioPublicUrl(song.song_path);

        const cachedUrl = await getCachedAudioUrl(publicUrl);
        if (cachedUrl) {
          setAudioUrl(cachedUrl);
        } else {
          setAudioUrl(publicUrl);
          cacheAudioFile(publicUrl, song.song_path);
        }

        playRef.current = true;
        setCurrentTime(0);
      };

      loadAudio();
    }
  }, [song]);

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (audioRef.current) audioRef.current.muted = newMuted;
  };

  const formatTime = (time) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;

  if (!song || !audioUrl) return null;

  return (
    <>
      {/* Desktop player — full-width bar */}
      <div className="fixed bottom-14 left-0 right-0 z-[9999] hidden md:block md:bottom-0">
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
              onChange={(e) => {
                const time = Number(e.target.value);
                if (audioRef.current) {
                  audioRef.current.currentTime = time;
                  setCurrentTime(time);
                }
              }}
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
                    onClick={() => {
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
                    onClick={onPlayPrevious}
                    className="rounded-full p-1.5 text-neutral-500 transition active:scale-90 hover:text-neutral-900"
                  >
                    <SkipBack size={17} fill="currentColor" />
                  </button>

                  <button
                    type="button"
                    onClick={togglePlay}
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
                    onClick={onPlayNext}
                    className="rounded-full p-1.5 text-neutral-500 transition active:scale-90 hover:text-neutral-900"
                  >
                    <SkipForward size={17} fill="currentColor" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
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
                  onClick={toggleMute}
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
        className="fixed bottom-14 left-0 right-0 z-[9999] md:hidden cursor-pointer shadow-lg shadow-neutral-900/5"
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

      {/* Mobile full-screen player overlay */}
      {showFullPlayer && (
        <div className="fixed inset-0 z-[99999] flex flex-col md:hidden animate-fade-in">
          {/* Full-bleed gradient background */}
          <div className="absolute inset-0" style={{ background: pastelGradient(song.title || "") }} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-black/60" />

          {/* Header */}
          <div className="relative z-10 flex items-center justify-between px-5 pt-5 pb-2">
            <button
              type="button"
              onClick={() => setShowFullPlayer(false)}
              className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-white/60"
            >
              <ChevronDown size={20} />
            </button>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
              Now Playing
            </span>
            <div className="w-5" />
          </div>

          {/* Artwork — large initial letter */}
          <div className="relative z-10 flex flex-1 items-center justify-center px-8">
            <div className="flex items-center justify-center">
              <span className="text-[140px] font-bold leading-none text-white/90 drop-shadow-xl select-none">
                {initialLetter(song.title)}
              </span>
            </div>
          </div>

          {/* Song info */}
          <div className="relative z-10 px-6 pb-3">
            <h2 className="text-xl font-bold tracking-tight text-white drop-shadow-sm">
              {song.title}
            </h2>
            <p className="mt-1 text-sm font-medium text-white/70">
              {song.author}
            </p>
          </div>

          {/* Glass-morphism controls panel */}
          <div className="relative z-10 rounded-t-3xl bg-white/10 backdrop-blur-2xl border-t border-white/20 px-5 pt-4 pb-8">
            {/* Seek bar */}
            <div className="mb-1">
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={(e) => {
                  const time = Number(e.target.value);
                  if (audioRef.current) {
                    audioRef.current.currentTime = time;
                    setCurrentTime(time);
                  }
                }}
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
                onClick={onPlayPrevious}
                className="rounded-full p-1.5 text-white/70 transition active:scale-90"
              >
                <SkipBack size={24} fill="currentColor" />
              </button>

              <button
                type="button"
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
                onClick={onPlayNext}
                className="rounded-full p-1.5 text-white/70 transition active:scale-90"
              >
                <SkipForward size={24} fill="currentColor" />
              </button>

              <button
                type="button"
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
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
        }}
        onCanPlay={() => {
          if (playRef.current) {
            playRef.current = false;
            audioRef.current?.play().catch(() => {});
            setIsPlaying(true);
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onEnded={onPlayNext}
      />
    </>
  );
};

export default Player;
