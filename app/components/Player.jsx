"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { usePlayer } from "../context/PlayerContext"; // Added Context
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

  // MediaSession API integration
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
          cacheAudioFile(publicUrl);
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

  if (!song || !audioUrl) return null;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-[9999] h-auto border-t border-white/80 bg-white/92 shadow-[0_-18px_50px_rgba(15,23,42,0.10)] backdrop-blur-2xl md:bottom-0 md:h-24">
      <div className="absolute -top-[1px] left-0 h-[3px] w-full cursor-pointer bg-neutral-100">
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
          className="absolute top-0 left-0 w-full h-full accent-accent bg-transparent cursor-pointer appearance-none z-10"
        />
        <div
          className="pointer-events-none absolute top-0 left-0 h-full bg-accent transition-all"
          style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
        />
      </div>

      <div className="mx-auto h-full max-w-[1400px] px-4 py-3 md:px-6">
        <div className="flex h-full flex-col items-center justify-between gap-y-3 md:flex-row">
          <div className="flex min-w-0 w-full items-center gap-x-3 md:w-[28%]">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-accent shadow-lg shadow-accent/15">
              <Music
                className={`text-white ${isPlaying ? "animate-spin-slow" : ""}`}
                size={18}
              />
            </div>
            <div className="min-w-0 truncate">
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.24em] text-neutral-400">
                Now Playing
              </p>
              <p className="truncate text-[14px] font-semibold leading-none tracking-tight text-neutral-900">
                {song.title}
              </p>
              <p className="mt-1 truncate text-[12px] font-medium leading-none text-neutral-500">
                {song.author}
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col items-center gap-y-1 md:flex-1">
            <div className="flex items-center justify-center gap-x-3 md:gap-x-6">
              <button
                type="button"
                onClick={() => {
                  const newState = !isShuffle;
                  setIsShuffle(newState);
                  if (newState) setIsLooping(false);
                }}
className={`rounded-full p-2 transition-colors active:scale-90 ${isShuffle
                  ? "bg-accent/10 text-accent"
                  : "text-neutral-400 hover:bg-neutral-50 hover:text-neutral-900"
                  }`}
              >
                <Shuffle size={18} />
              </button>

              <button
                type="button"
                onClick={onPlayPrevious}
                className="rounded-full p-2 text-neutral-900 transition active:scale-90 hover:bg-neutral-50"
              >
                <SkipBack size={24} fill="currentColor" />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/10 transition hover:bg-accent/90 active:scale-95"
              >
                {isPlaying ? (
                  <Pause size={24} fill="currentColor" />
                ) : (
                  <Play size={24} fill="currentColor" className="ml-1" />
                )}
              </button>

              <button
                type="button"
                onClick={onPlayNext}
                className="rounded-full p-2 text-neutral-900 transition active:scale-90 hover:bg-neutral-50"
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
className={`rounded-full p-2 transition-colors active:scale-90 ${isLooping
                  ? "bg-accent/10 text-accent"
                  : "text-neutral-400 hover:bg-neutral-50 hover:text-neutral-900"
                  }`}
              >
                <Repeat size={18} />
              </button>
            </div>
            <div className="rounded-full border border-neutral-100 bg-neutral-50 px-3 py-1 text-[11px] font-medium tabular-nums text-neutral-400">
              {formatTime(currentTime)}{" "}
              <span className="mx-1 opacity-50">/</span> {formatTime(duration)}
            </div>
          </div>

          <div className="hidden w-[28%] items-center justify-end gap-x-3 md:flex">
            <button
              type="button"
              onClick={toggleMute}
              className="rounded-full p-2 text-neutral-400 transition hover:bg-neutral-50 hover:text-accent"
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
              className="h-1 w-24 cursor-pointer appearance-none rounded-lg bg-neutral-100 accent-accent"
            />
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
