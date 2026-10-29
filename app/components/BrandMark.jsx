"use client";

// Small Luumbo squircle mark (L monogram). Used next to the wordmark in the
// shell and on the auth screen so the in-app brand matches the app icon.
export default function BrandMark({ className = "h-7 w-7" }) {
  return (
    <img
      src="/icons/mark.svg?v=2"
      alt=""
      aria-hidden="true"
      className={`shrink-0 select-none ${className}`}
      draggable={false}
    />
  );
}
