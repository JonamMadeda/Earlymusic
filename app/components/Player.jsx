"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { usePlayer } from "../context/PlayerContext"; // Added Context
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Disc,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { getCachedAudioUrl, cacheAudioFile } from "@/lib/cacheUtils";

const Player = () => {
  const audioRef = useRef(null);
  // Using global context instead of props to ensure the queue is always correct
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

  useEffect(() => {
    if (song) {
      const loadAudio = async () => {
        const { data } = supabase.storage
          .from("songs")
          .getPublicUrl(song.song_path);

        const publicUrl = data.publicUrl;

        // Check cache first
        const cachedUrl = await getCachedAudioUrl(publicUrl);
        if (cachedUrl) {
          setAudioUrl(cachedUrl);
        } else {
          setAudioUrl(publicUrl);
          // Gently cache it for next time
          cacheAudioFile(publicUrl);
        }

        setIsPlaying(true);
        setCurrentTime(0);
      };

      loadAudio();
    }
  }, [song]);

  // Sync isPlaying state with audio element
  useEffect(() => {
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.error("Playback error:", error);
          setIsPlaying(false);
        });
      }
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, audioUrl]);

  const onPlayNext = () => {
    if (!songs || songs.length === 0) return;

    if (isShuffle) {
      let nextIndex = currentIndex;
      if (songs.length > 1) {
        while (nextIndex === currentIndex) {
          nextIndex = Math.floor(Math.random() * songs.length);
        }
      }
      onSongSelect(songs[nextIndex], songs); // Pass queue back to keep context
    } else {
      const nextIndex = (currentIndex + 1) % songs.length;
      onSongSelect(songs[nextIndex], songs);
    }
  };

  const onPlayPrevious = () => {
    if (!songs || songs.length === 0) return;
    const prevIndex = currentIndex <= 0 ? songs.length - 1 : currentIndex - 1;
    onSongSelect(songs[prevIndex], songs);
  };

  const togglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

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
    <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-white/95 backdrop-blur-xl border-t border-neutral-100 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] h-auto md:h-24">
      {/* PROGRESS BAR */}
      <div className="absolute -top-[1px] left-0 w-full h-[3px] bg-neutral-100 group cursor-pointer">
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
          className="absolute top-0 left-0 w-full h-full accent-red-600 bg-transparent cursor-pointer appearance-none z-10"
        />
        <div
          className="absolute top-0 left-0 h-full bg-red-600 transition-all pointer-events-none"
          style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
        />
      </div>

      <div className="max-w-[1400px] mx-auto px-5 py-3 md:px-8 h-full">
        <div className="flex flex-col md:flex-row items-center justify-between h-full gap-y-3">
          {/* TRACK INFO */}
          <div className="flex items-center gap-x-3 w-full md:w-[25%] min-w-0">
            <div className="w-10 h-10 bg-neutral-900 rounded-lg flex-shrink-0 flex items-center justify-center shadow-lg">
              <Disc
                className={`text-white ${isPlaying ? "animate-spin-slow" : ""}`}
                size={18}
              />
            </div>
            <div className="truncate">
              <p className="text-[14px] font-semibold text-neutral-900 truncate tracking-tight mb-0.5 leading-none">
                {song.title}
              </p>
              <p className="text-[12px] font-medium text-neutral-400 truncate leading-none">
                {song.author}
              </p>
            </div>
          </div>

          {/* CONTROLS */}
          <div className="flex flex-col items-center gap-y-1 w-full md:flex-1">
            <div className="flex items-center justify-center gap-x-4 md:gap-x-8">
              <button
                type="button"
                onClick={() => {
                  const newState = !isShuffle;
                  setIsShuffle(newState);
                  if (newState) setIsLooping(false); // Mutually exclusive
                }}
                className={`transition-colors active:scale-90 ${isShuffle
                  ? "text-red-600"
                  : "text-neutral-400 hover:text-neutral-900"
                  }`}
              >
                <Shuffle size={18} />
              </button>

              <button
                type="button"
                onClick={onPlayPrevious}
                className="text-neutral-900 active:scale-90 transition"
              >
                <SkipBack size={24} fill="currentColor" />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                className="bg-red-600 rounded-full h-12 w-12 flex items-center justify-center text-white shadow-lg active:scale-95 transition hover:bg-red-700"
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
                className="text-neutral-900 active:scale-90 transition"
              >
                <SkipForward size={24} fill="currentColor" />
              </button>

              <button
                type="button"
                onClick={() => {
                  const newState = !isLooping;
                  setIsLooping(newState);
                  if (newState) setIsShuffle(false); // Mutually exclusive
                }}
                className={`transition-colors active:scale-90 ${isLooping
                  ? "text-red-600"
                  : "text-neutral-400 hover:text-neutral-900"
                  }`}
              >
                <Repeat size={18} />
              </button>
            </div>
            <div className="text-[11px] text-neutral-400 font-medium tabular-nums">
              {formatTime(currentTime)}{" "}
              <span className="mx-1 opacity-50">/</span> {formatTime(duration)}
            </div>
          </div>

          {/* VOLUME */}
          <div className="hidden md:flex items-center gap-x-3 w-[25%] justify-end">
            <button
              type="button"
              onClick={toggleMute}
              className="text-neutral-400 hover:text-red-600 transition"
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
              className="w-24 h-1 accent-red-600 bg-neutral-100 rounded-lg appearance-none cursor-pointer"
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
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onEnded={onPlayNext}
      />
    </div>
  );
};

export default Player;
