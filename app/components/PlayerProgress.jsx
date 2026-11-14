"use client";

import { useEffect, useRef, useState } from "react";
import { formatTime } from "@/lib/timeFormat";

// currentTime ticks several times a second. Keeping that state here instead of
// in Player means a tick re-renders only the progress UI, not the whole overlay
// and every queue row behind it.
const useAudioTime = (audioRef, holdRef) => {
  const [time, setTime] = useState(0);

  useEffect(() => {
    const audio = audioRef?.current;
    if (!audio) return;
    const sync = () => {
      if (!holdRef?.current) setTime(audio.currentTime || 0);
    };
    sync();
    audio.addEventListener("timeupdate", sync);
    audio.addEventListener("seeked", sync);
    audio.addEventListener("loadedmetadata", sync);
    audio.addEventListener("emptied", sync);
    return () => {
      audio.removeEventListener("timeupdate", sync);
      audio.removeEventListener("seeked", sync);
      audio.removeEventListener("loadedmetadata", sync);
      audio.removeEventListener("emptied", sync);
    };
  }, [audioRef, holdRef]);

  return time;
};

// Shared drag behaviour: seeking on every input event made the audio stutter,
// and a gesture cancelled by the OS never fired pointerup, which left the
// scrubbing flag set and froze the clock for the rest of the track.
const useScrub = (audioRef, duration, onSeek) => {
  const holdRef = useRef(false);
  const time = useAudioTime(audioRef, holdRef);
  const [dragValue, setDragValue] = useState(null);

  const begin = () => {
    holdRef.current = true;
    setDragValue(time);
  };

  const change = (raw) => {
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    // Keyboard and click-to-position arrive without a pointerdown, so those
    // commit straight away; a drag waits for release.
    if (holdRef.current) setDragValue(value);
    else onSeek(value);
  };

  const end = () => {
    if (!holdRef.current) return;
    holdRef.current = false;
    if (dragValue != null) onSeek(dragValue);
    setDragValue(null);
  };

  const cancel = () => {
    holdRef.current = false;
    setDragValue(null);
  };

  const value = dragValue ?? time;
  const max = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  return { value, max, percent, begin, change, end, cancel, held: holdRef };
};

const seekProps = (scrub, label) => ({
  type: "range",
  min: 0,
  max: scrub.max,
  step: "any",
  value: scrub.value,
  "aria-label": label,
  "aria-valuetext": `${formatTime(scrub.value)} of ${formatTime(scrub.max)}`,
  onPointerDown: scrub.begin,
  onPointerUp: scrub.end,
  onPointerCancel: scrub.cancel,
  onChange: (event) => scrub.change(event.target.value),
  onBlur: scrub.end,
});

/**
 * The 4px progress strip on the player bar and the floating mini card. The
 * visible track stays thin, but the input covers 16px so a thumb can actually
 * hit it — the empty padding below the track belongs to the seek target.
 */
export const ThinProgress = ({ audioRef, duration, onSeek, trackClassName = "" }) => {
  const scrub = useScrub(audioRef, duration, onSeek);

  return (
    <div className="group relative h-1 bg-neutral-100">
      <input
        {...seekProps(scrub, "Seek through song")}
        onClick={(event) => event.stopPropagation()}
        className="absolute inset-x-0 top-0 z-20 h-4 w-full cursor-pointer opacity-0"
      />
      <div
        className={`h-full bg-accent transition-[width] duration-150 ${trackClassName}`}
        style={{ width: `${scrub.percent}%` }}
      />
      <div
        className="pointer-events-none absolute top-1/2 z-30 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-white bg-accent opacity-0 shadow-md transition-opacity group-hover:opacity-100"
        style={{ left: `${scrub.percent}%`, marginLeft: "-7px" }}
      />
    </div>
  );
};

/** The full-screen player's slider with elapsed and remaining readouts. */
export const SeekBar = ({ audioRef, duration, onSeek }) => {
  const scrub = useScrub(audioRef, duration, onSeek);

  return (
    <div className="mb-2">
      <div className="relative flex items-center py-2">
        <input
          {...seekProps(scrub, "Seek through song")}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-accent [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-lg"
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium tabular-nums text-neutral-500">
          {formatTime(scrub.value)}
        </span>
        <span className="text-xs font-medium tabular-nums text-neutral-500">
          -{formatTime(Math.max(0, scrub.max - scrub.value))}
        </span>
      </div>
    </div>
  );
};

/** Elapsed / remaining line under the desktop bar's transport controls. */
export const TimeReadout = ({ audioRef, duration }) => {
  const holdRef = useRef(false);
  const time = useAudioTime(audioRef, holdRef);
  const total = Number.isFinite(duration) && duration > 0 ? duration : 0;

  return (
    <div className="flex items-center gap-1 text-[10px] font-medium tabular-nums text-neutral-400">
      <span>{formatTime(time)}</span>
      <span className="text-neutral-300">/</span>
      <span>-{formatTime(Math.max(0, total - time))}</span>
    </div>
  );
};