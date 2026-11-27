"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck, X } from "lucide-react";
import SongRightsNotice from "./SongRightsNotice";

export default function SongRightsDialog({
  open,
  song,
  dark = false,
  onClose,
  onPolicyClick,
  returnFocusRef,
}) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;
    const dialog = dialogRef.current;
    const returnTarget = returnFocusRef?.current || document.activeElement;
    const focusTimer = setTimeout(() => dialog?.querySelector("button")?.focus(), 0);
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialog?.querySelectorAll(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) || []
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown, true);
      returnTarget?.focus?.();
    };
  }, [open, returnFocusRef]);

  if (!open || !song || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="presentation"
      className={`fixed inset-0 z-[1200] flex items-end justify-center p-0 backdrop-blur-sm sm:items-center sm:p-4 ${
        dark ? "bg-[#020617]/70" : "bg-neutral-900/60"
      }`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl border p-5 shadow-2xl sm:rounded-2xl sm:p-6 ${
          dark
            ? "border-white/10 bg-[#0f172a] text-white"
            : "border-neutral-200 bg-white text-neutral-900"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="flex items-center gap-2 text-base font-bold tracking-tight">
              <ShieldCheck size={17} className={dark ? "text-white/70" : "text-neutral-400"} aria-hidden="true" />
              Copyright &amp; song rights
            </h2>
            <p className={`mt-1 truncate text-xs ${dark ? "text-white/50" : "text-neutral-500"}`}>
              {song.title}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close copyright information"
            onClick={onClose}
            className={`tap-sm flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${
              dark
                ? "text-white/50 hover:bg-white/10 hover:text-white"
                : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
            }`}
          >
            <X size={18} />
          </button>
        </div>
        <SongRightsNotice
          song={song}
          dark={dark}
          compact
          headingLevel="h3"
          className="mt-4"
          onPolicyClick={() => {
            onClose();
            onPolicyClick?.();
          }}
        />
      </div>
    </div>,
    document.body
  );
}
