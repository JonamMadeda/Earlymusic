"use client";

import { useState } from "react";
import { BellRing, X } from "lucide-react";
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
 * Compact controls for the Library dot. Kept here rather than on the settings
 * page so the listener can quiet it at the exact moment it catches their eye.
 */
export default function SpotlightNudgeSettings() {
  const [open, setOpen] = useState(false);
  const { mode, windowHour, snoozed } = useLibraryNudge();

  return (
    <div className="relative ml-auto">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-neutral-500 transition hover:border-neutral-300 hover:text-neutral-800 outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        <BellRing size={13} aria-hidden="true" />
        Alerts
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Spotlight alert settings"
          className="absolute right-0 top-full z-40 mt-2 w-64 rounded-xl border border-neutral-200 bg-white p-3 text-left shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold tracking-tight text-neutral-900">Spotlight alerts</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close alert settings"
              className="flex h-6 w-6 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            >
              <X size={13} aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-1">
            {MODES.map((option) => (
              <button
                key={option.key}
                type="button"
                aria-pressed={mode === option.key}
                onClick={() => setNudgeMode(option.key)}
                className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition ${
                  mode === option.key ? "bg-accent/8" : "hover:bg-neutral-50"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    mode === option.key ? "bg-accent" : "bg-neutral-300"
                  }`}
                />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-neutral-800">{option.label}</span>
                  <span className="block text-[11px] leading-snug text-neutral-500">{option.hint}</span>
                </span>
              </button>
            ))}
          </div>

          {mode === "daily" && (
            <label className="mt-2 block border-t border-neutral-100 pt-2">
              <span className="text-[11px] font-semibold text-neutral-600">Reminder window</span>
              <select
                value={windowHour ?? "auto"}
                onChange={(event) => setNudgeWindowHour(event.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs font-medium text-neutral-700 outline-none focus:border-accent"
              >
                <option value="auto">Rotate each day</option>
                <option value="7">Morning · 7:00</option>
                <option value="12">Lunch · 12:00</option>
                <option value="18">Evening · 18:00</option>
              </select>
            </label>
          )}

          <button
            type="button"
            onClick={() => {
              snoozeLibraryNudge();
              setOpen(false);
            }}
            disabled={snoozed}
            className="mt-2 w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-[11px] font-semibold text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-50"
          >
            {snoozed ? "Snoozed for 2 hours" : "Remind me later"}
          </button>
        </div>
      )}
    </div>
  );
}
