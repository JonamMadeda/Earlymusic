"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { usePlayer } from "../context/PlayerContext";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Music,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  ChevronUp,
} from "lucide-react";
import { getCachedAudioUrl, cacheAudioFile } from "@/lib/cacheUtils";

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
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("earlymusic_player_expanded");
    if (stored === "true") setExpanded(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("earlymusic_player_expanded", expanded);
  }, [expanded]);

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
        const { data } = supabase.storage
          .from("songs")
          .getPublicUrl(song.song_path);

        const publicUrl = data.publicUrl;

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
    <div className="fixed bottom-14 left-0 right-0 z-[9999] md:bottom-0 md:left-1/2 md:w-3/5 lg:w-2/5 xl:w-[520px] md:-translate-x-1/2">
      <div className="relative mx-auto max-w-[1400px] md:px-6">
        <div
          className={`relative overflow-hidden border-t border-white/70 bg-white/95 backdrop-blur-2xl transition-all duration-300 md:mb-4 md:rounded-2xl md:border ${
            expanded ? "rounded-t-2xl" : ""
          }`}
        >
          {/* Progress bar */}
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-neutral-100/60 z-10">
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
              className="h-full bg-accent transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Mobile mini-bar */}
          <div
            className="flex md:hidden items-center gap-3 px-3 py-2.5 cursor-pointer active:bg-neutral-50/50"
            onClick={() => setExpanded(!expanded)}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white shadow-sm shadow-accent/15">
              <div className={`waveform${isPlaying ? "" : " paused"}`}>
                <span /><span /><span /><span />
              </div>
            </div>
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
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-sm shadow-accent/10 active:scale-90 transition"
            >
              {isPlaying ? (
                <Pause size={15} fill="currentColor" />
              ) : (
                <Play size={15} fill="currentColor" className="ml-0.5" />
              )}
            </button>
            <ChevronUp
              size={14}
              className={`shrink-0 text-neutral-300 transition-transform duration-300 ${
                expanded ? "rotate-180" : ""
              }`}
            />
          </div>

          {/* Expanded area */}
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden ${
              expanded ? "max-h-48 opacity-100" : "max-h-0 opacity-0"
            } md:!max-h-full md:!opacity-100`}
          >
            <div className="px-4 pb-5 pt-3 md:px-6 md:py-3">
              <div className="flex flex-col gap-y-4 md:flex-row md:items-center">

                {/* Song info (desktop only — shown in mini-bar on mobile) */}
                <div className="hidden md:flex md:items-center md:gap-3 md:w-[28%]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent shadow-sm shadow-accent/15">
                    <div className={`waveform text-white${isPlaying ? "" : " paused"}`}>
                      <span /><span /><span /><span />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold tracking-tight text-neutral-900">
                      {song.title}
                    </p>
                    <p className="truncate text-[11px] font-medium text-neutral-400">
                      {song.author}
                    </p>
                  </div>
                </div>

                {/* Controls + time */}
                <div className="flex flex-col items-center gap-2 md:flex-1">
                  <div className="flex items-center justify-center gap-x-2 md:gap-x-4">
                    <div className="flex items-center gap-x-1 pr-2 md:pr-3 border-r border-neutral-200">
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
                        <Shuffle size={14} />
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
                        <Repeat size={14} />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={onPlayPrevious}
                      className="rounded-full p-1.5 text-neutral-600 transition active:scale-90 hover:text-neutral-900"
                    >
                      <SkipBack size={20} fill="currentColor" />
                    </button>

                    <button
                      type="button"
                      onClick={togglePlay}
                      className="hidden md:flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white shadow-md shadow-accent/10 transition hover:bg-accent/90 active:scale-95"
                    >
                      {isPlaying ? (
                        <Pause size={22} fill="currentColor" />
                      ) : (
                        <Play size={22} fill="currentColor" className="ml-0.5" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={onPlayNext}
                      className="rounded-full p-1.5 text-neutral-600 transition active:scale-90 hover:text-neutral-900"
                    >
                      <SkipForward size={20} fill="currentColor" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-medium tabular-nums text-neutral-400">
                    <span>{formatTime(currentTime)}</span>
                    <span className="text-neutral-300">/</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Volume (desktop only) */}
                <div className="hidden md:flex md:w-[28%] md:items-center md:justify-end md:gap-3">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="rounded-full p-2 text-neutral-400 transition hover:text-accent"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX size={18} />
                    ) : (
                      <Volume2 size={18} />
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
                    className="h-1 w-28 cursor-pointer appearance-none rounded-full bg-neutral-100 accent-accent"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
    </div>
  );
};

export default Player;
