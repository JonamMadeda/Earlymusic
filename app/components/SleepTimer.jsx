"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Timer, X } from "lucide-react";
import { usePlayer } from "../context/PlayerContext";

export const SLEEP_TIMER_OPTIONS = [
  { minutes: 30, label: "30 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 90, label: "90 minutes" },
  { minutes: 180, label: "3 hours" },
];

export const formatSleepTimerRemaining = (ms) => {
  if (!ms || ms <= 0) return "0:00";

  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export function SleepTimerControl({ dark = false }) {
  const {
    sleepTimerEnd,
    sleepTimerDuration,
    sleepTimerRemaining,
    setSleepTimer,
    cancelSleepTimer,
  } = usePlayer();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const active = !!sleepTimerEnd && sleepTimerRemaining > 0;

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const triggerClass = dark
    ? active
      ? "bg-white text-neutral-900"
      : "bg-white/10 text-white/80 hover:bg-white/20"
    : active
      ? "bg-accent text-white"
      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200";

  return (
    <div
      ref={containerRef}
      className="relative"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          active
            ? `Sleep timer: ${formatSleepTimerRemaining(sleepTimerRemaining)} remaining`
            : "Set sleep timer"
        }
        onClick={() => setOpen((value) => !value)}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${triggerClass}`}
      >
        <Timer size={15} />
        <span>{active ? formatSleepTimerRemaining(sleepTimerRemaining) : "Timer"}</span>
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute bottom-full right-0 z-[1000] mb-2 w-56 rounded-2xl border p-2 shadow-2xl ${
            dark
              ? "border-white/15 bg-[#111a2c] text-white"
              : "border-neutral-200 bg-white text-neutral-900"
          }`}
        >
          <p
            className={`px-2.5 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-widest ${
              dark ? "text-white/50" : "text-neutral-400"
            }`}
          >
            Sleep Timer
          </p>

          {SLEEP_TIMER_OPTIONS.map((option) => {
            const selected = active && sleepTimerDuration === option.minutes;
            return (
              <button
                key={option.minutes}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  setSleepTimer(option.minutes);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs font-medium transition ${
                  dark ? "hover:bg-white/10" : "hover:bg-neutral-100"
                } ${selected ? "font-semibold" : ""}`}
              >
                <span>{option.label}</span>
                {selected && <Check size={14} />}
              </button>
            );
          })}

          {active && (
            <>
              <div className={`my-1 h-px ${dark ? "bg-white/10" : "bg-neutral-100"}`} />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  cancelSleepTimer();
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-red-500 transition ${
                  dark ? "hover:bg-white/10" : "hover:bg-red-50"
                }`}
              >
                <X size={14} />
                Turn off timer
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function SleepTimerSettings() {
  const {
    sleepTimerEnd,
    sleepTimerDuration,
    sleepTimerRemaining,
    setSleepTimer,
  } = usePlayer();

  const active = !!sleepTimerEnd && sleepTimerRemaining > 0;

  const pillClass = (selected) =>
    `rounded-full px-3.5 py-2 text-xs font-semibold transition ${
      selected
        ? "bg-accent text-white shadow-sm"
        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
    }`;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setSleepTimer(0)} className={pillClass(!active)}>
          Off
        </button>

        {SLEEP_TIMER_OPTIONS.map((option) => (
          <button
            key={option.minutes}
            type="button"
            onClick={() => setSleepTimer(option.minutes)}
            className={pillClass(active && sleepTimerDuration === option.minutes)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <p className="mt-3 text-xs text-neutral-500">
        {active
          ? `Music will stop in ${formatSleepTimerRemaining(sleepTimerRemaining)}.`
          : "Music plays continuously until you set a timer."}
      </p>
    </div>
  );
}
