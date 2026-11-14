"use client";

import { useEffect, useId, useRef } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Shared destructive-action confirmation dialog. Focus lands on Cancel,
 * Tab is trapped inside, and focus returns to the opener on close.
 * `details` optionally lists what will be removed and what will remain.
 */
const ConfirmModal = ({
  isOpen,
  title = "Are you sure?",
  message = "This action cannot be undone.",
  details = null,
  confirmLabel = "Confirm",
  busy = false,
  onConfirm,
  onClose,
}) => {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement;
    cancelRef.current?.focus();
    return () => {
      if (opener instanceof HTMLElement && document.contains(opener)) {
        opener.focus();
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (busy) {
        if (e.key === "Escape" || e.key === "Tab") e.preventDefault();
        return;
      }
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = dialogRef.current?.querySelectorAll(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!dialogRef.current.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, busy, onClose]);

  if (!isOpen) return null;

  const removed = details?.removed || [];
  const kept = details?.kept || [];

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-neutral-900/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        aria-busy={busy}
        className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-neutral-100 bg-white p-6 shadow-2xl animate-fade-in"
      >
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertTriangle size={20} aria-hidden="true" />
        </div>
        <h2 id={titleId} className="text-base font-bold tracking-tight text-neutral-900">
          {title}
        </h2>
        <p id={messageId} className="mt-1 text-sm leading-relaxed text-neutral-500">
          {message}
        </p>
        {(removed.length > 0 || kept.length > 0) && (
          <div className="mt-4 space-y-3 rounded-xl border border-neutral-100 bg-neutral-50 p-4">
            {removed.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-red-700">
                  Will be removed
                </p>
                <ul className="mt-1.5 space-y-1 text-sm text-neutral-700">
                  {removed.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {kept.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Will remain
                </p>
                <ul className="mt-1.5 space-y-1 text-sm text-neutral-700">
                  {kept.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <div className="mt-5 flex gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={busy}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="btn-destructive flex-1"
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;