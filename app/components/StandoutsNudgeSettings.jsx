"use client";

import { BellOff, Check } from "lucide-react";
import {
  setNudgeMode,
  setNudgeWindowHour,
  snoozeLibraryNudge,
  useLibraryNudge,
} from "@/lib/libraryNudge";

const MODES = [
  { key: "content", label: "New activity", hint: "Only when Picks or Highlights change" },
  { key: "daily", label: "Daily reminder", hint: "One short window each day" },
  { key: "off", label: "Off", hint: "No dot on the Library tab" },
];

/**
 * The contents of the Standouts overflow menu. Kept here rather than on a
 * settings page so the listener can quiet the dot at the moment it catches
 * their eye, without adding a second visible control to the tab strip.
 */
export default function StandoutsNudgeSettings({ onDone }) {
  const { mode, windowHour, snoozed } = useLibraryNudge();

  return (
    <div className="w-64 p-1 text-left" onClick={(event) => event.stopPropagation()}>
      <div className="px-2 pb-2 pt-1">
        <p className="text-xs font-bold tracking-tight text-neutral-900">Standouts alerts</p>
        <p className="mt-0.5 text-xs leading-snug text-neutral-500">
          Choose when the Library tab should nudge you.
        </p>
      </div>

      <div className="space-y-0.5">
        {MODES.map((option) => {
          const selected = mode === option.key;
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={selected}
              onClick={() => setNudgeMode(option.key)}
              className={`flex min-h-11 w-full items-start gap-2 rounded-xl px-2 py-2 text-left transition ${
                selected ? "bg-accent/8" : "hover:bg-neutral-50"
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                  selected ? "border-accent bg-accent text-white" : "border-neutral-300"
                }`}
              >
                {selected && <Check size={9} strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-neutral-800">{option.label}</span>
                <span className="block text-xs leading-snug text-neutral-500">{option.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      {mode === "daily" && (
        <label className="mt-2 block border-t border-neutral-100 px-2 pt-3">
          <span className="text-xs font-semibold text-neutral-600">Reminder window</span>
          <select
            value={windowHour ?? "auto"}
            onChange={(event) => setNudgeWindowHour(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-2.5 py-2 text-xs font-medium text-neutral-700 outline-none focus:border-accent"
          >
            <option value="auto">Rotate each day</option>
            <option value="7">Morning · 7:00</option>
            <option value="12">Lunch · 12:00</option>
            <option value="18">Evening · 18:00</option>
          </select>
        </label>
      )}

      <div className="mt-2 flex gap-2 border-t border-neutral-100 px-2 pt-3">
        <button
          type="button"
          onClick={() => {
            snoozeLibraryNudge();
            onDone?.();
          }}
          disabled={snoozed}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-neutral-200 px-2 py-2 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-50"
        >
          <BellOff size={13} aria-hidden="true" />
          {snoozed ? "Snoozed 2h" : "Snooze 2h"}
        </button>
        <button
          type="button"
          onClick={() => onDone?.()}
          className="min-h-10 rounded-xl bg-neutral-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-neutral-800"
        >
          Done
        </button>
      </div>
    </div>
  );
}
