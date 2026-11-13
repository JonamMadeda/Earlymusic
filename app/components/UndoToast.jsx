"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * Undo toast for staged destructive actions. The timer calls onDismiss when
 * the window closes (the caller commits the deletion there); onAction fires
 * when the listener takes the action back. Render with a `key` per action so
 * a new toast always starts a fresh window.
 */
const UndoToast = ({
  message,
  actionLabel = "Undo",
  onAction,
  onDismiss,
  duration = 8000,
  expiresAt,
}) => {
  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const remaining = expiresAt == null ? duration : Math.max(0, expiresAt - Date.now());
    const timer = setTimeout(() => dismissRef.current?.(), remaining);
    return () => clearTimeout(timer);
  }, [duration, expiresAt]);

  return (
    <div className="fixed bottom-24 left-1/2 z-[1050] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 md:bottom-28">
      <div
        role="status"
        aria-live="polite"
        className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-900 px-4 py-3 text-white shadow-2xl animate-fade-in"
      >
        <p className="text-sm font-medium">{message}</p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onAction}
            className="rounded-full px-3 py-1.5 text-sm font-bold text-emerald-400 transition hover:bg-white/10"
          >
            {actionLabel}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="rounded-full p-1.5 text-neutral-400 transition hover:bg-white/10 hover:text-white"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default UndoToast;