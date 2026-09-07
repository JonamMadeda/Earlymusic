"use client";

// Root error boundary: catches page-level runtime errors WITHOUT unmounting
// the root layout — so the Player (and any playing song) survives a crash
// on any page instead of being torn down with the whole tree.
export default function Error({ error, reset }) {
  return (
    <main className="min-h-[60vh] bg-white px-6 py-16 text-center">
      <p className="text-base font-bold tracking-tight text-neutral-900">
        Something went wrong here
      </p>
      <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-neutral-500">
        Your playback was not affected. Try reloading this section.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-accent/90"
      >
        Try again
      </button>
    </main>
  );
}
