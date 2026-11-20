"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ListMusic } from "lucide-react";

/**
 * Small focused dialog for naming / renaming a playlist. Keeps the Library
 * free of an inline form while still giving rename a real input, validation,
 * Escape-to-close, and focus management.
 */
export default function PlaylistNameDialog({
  isOpen,
  title = "Name your playlist",
  initialValue = "",
  confirmLabel = "Save",
  busy = false,
  onConfirm,
  onClose,
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return undefined;
    const opener = document.activeElement;
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      clearTimeout(timer);
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKey = (event) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, busy, onClose]);

  if (!isOpen) return null;

  const trimmed = value.trim();

  const submit = (event) => {
    event.preventDefault();
    if (!trimmed || busy) return;
    onConfirm(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-neutral-900/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-neutral-100 bg-white p-5 shadow-2xl animate-fade-in"
      >
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-accent/10 bg-accent/[0.06] text-accent">
          <ListMusic size={18} aria-hidden="true" />
        </div>
        <h2 id={titleId} className="text-base font-bold tracking-tight text-neutral-900">
          {title}
        </h2>
        <label className="mt-4 block">
          <span className="text-xs font-semibold text-neutral-600">Playlist name</span>
          <input
            ref={inputRef}
            type="text"
            value={value}
            maxLength={200}
            onChange={(event) => setValue(event.target.value)}
            placeholder="e.g. Sunday worship"
            aria-label="Playlist name"
            className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm font-medium text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-accent/40 focus:bg-white"
          />
        </label>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="submit" disabled={!trimmed || busy} className="btn-primary flex-1">
            {busy ? "Saving…" : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
