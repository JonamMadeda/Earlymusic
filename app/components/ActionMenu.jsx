"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

/**
 * One overflow affordance for dense rows and cards. On phones it opens as a
 * bottom sheet so the actions are finger-sized and never clipped; from `sm`
 * up it is an anchored menu. Escape and outside clicks close it.
 */
export default function ActionMenu({
  label = "More actions",
  triggerTitle = "More",
  children,
  align = "right",
  className = "",
  triggerClassName = "",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        title={triggerTitle}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className={
          triggerClassName ||
          "tap-sm flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
        }
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>

      {open && (
        <>
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[900] bg-neutral-900/40 sm:hidden"
          />
          <div
            role="menu"
            aria-label={label}
            onClick={(event) => event.stopPropagation()}
            className={`fixed inset-x-2 bottom-20 z-[901] max-h-[70vh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-2 shadow-2xl animate-modal-in sm:absolute sm:inset-auto sm:bottom-auto sm:top-full sm:z-40 sm:mt-2 sm:max-h-none sm:w-60 ${
              align === "left" ? "sm:left-0" : "sm:right-0"
            }`}
          >
            {typeof children === "function" ? children({ close: () => setOpen(false) }) : children}
          </div>
        </>
      )}
    </div>
  );
}
