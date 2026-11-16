"use client";

import { useState, useEffect } from "react";
import { useOnlineStatus } from "@/lib/useOnlineStatus";
import { CloudOff, LogIn, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import GlobalSearchModal from "./GlobalSearchModal";
import NotificationBell from "./NotificationBell";

const Header = () => {
  const pathname = usePathname();
  const isOnline = useOnlineStatus();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  // The header search bar is the home page's entry point into search. Every
  // other section either has its own field (songs, playlists, admin) or is a
  // signed-out screen where it reads as broken, so it appears on "/" only.
  // ⌘K still opens the modal anywhere.
  const isHomePage = pathname === "/";

  // The sidebar that carries Sign In is desktop-only, so mobile needs the
  // call to action here. Waiting on the session check keeps it from flashing
  // at someone who is already signed in.
  const { user, loading: authLoading } = useAuth();
  const showSignIn = isOnline && !authLoading && !user && pathname !== "/auth";

  // The bar is a row of the flex column in layout.js and sits *outside*
  // #app-scroll, so it is pinned by structure rather than by positioning: it
  // never scrolls, needs no `position` to keep it there, and takes its space
  // with it — the older negative-margin collapse is gone on purpose.

  // Keyboard shortcut Cmd/Ctrl + K to open search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      {/* Icon sizes follow one scale so the bar reads as a set: 18px for a glyph
          that is alone in its circle (search, bell) and 14 for a glyph next to a
          text label. The circles are .tap-sm (34px), and 18/34 is the ratio that
          stops them looking empty. Nothing in this row changes width with the
          connection state — see the offline row below it. */}
      <header className="relative z-[200] border-b border-neutral-100 bg-white/90 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4 px-4 py-1.5 md:px-6 md:py-2.5">
          {/* Mobile brand / Desktop search trigger */}
          <div className="flex items-center gap-3">
            <Link href="/" className="md:hidden flex items-center">
              {/* 18px is the size the wordmark carries everywhere it has room —
                  the sidebar brand — so the mobile bar reads as the same name
                  rather than a shrunken copy of it. */}
              <span className="text-[18px] leading-none font-bold tracking-tight text-neutral-900">
                Luumbo
              </span>
            </Link>

            {/* Desktop quick search button (home page only) */}
            {isHomePage && (
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="tap-sm hidden md:flex items-center gap-2.5 rounded-full border border-neutral-200 bg-neutral-50/80 px-3.5 py-1.5 text-xs text-neutral-400 hover:border-neutral-300 hover:bg-neutral-100/80 hover:text-neutral-700 transition shadow-sm w-64 lg:w-80"
              >
                <Search size={14} className="text-neutral-400" />
                <span className="flex-1 text-left">Search songs, artists...</span>
                <kbd className="rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-xs font-semibold text-neutral-400">
                  ⌘K
                </kbd>
              </button>
            )}
          </div>

          {/* Right side: Mobile search + announcements bell + sign-in prompt */}
          <div className="flex items-center gap-2">
            {/* Mobile search button (home page only) */}
            {isHomePage && (
              <button
                type="button"
                aria-label="Search"
                onClick={() => setIsSearchOpen(true)}
                className="tap-sm flex md:hidden h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 active:scale-95 transition"
              >
                <Search size={18} />
              </button>
            )}

            <NotificationBell />

            {showSignIn && (
              <Link
                href={`/auth?redirectTo=${encodeURIComponent(pathname || "/")}`}
                className="tap-sm md:hidden inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-[13px] font-bold text-white shadow-sm transition active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                <LogIn size={14} aria-hidden="true" />
                Sign in
              </Link>
            )}
          </div>
        </div>

        {/* Offline is a state of the whole app, not another control in the bar,
            so it gets its own row instead of a pill that shoves Sign in leftward
            on a 411px screen. role="status" announces the change in both
            directions; no pulse, because a persistent warning that animates
            forever reads as an alarm. */}
        {!isOnline && (
          <div
            role="status"
            className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-semibold text-amber-800 md:px-6"
          >
            <CloudOff size={12} aria-hidden="true" className="shrink-0" />
            <span className="min-w-0 flex-1">Offline — downloaded songs are available.</span>
            <a href="/library?tab=downloads" className="tap-sm inline-flex shrink-0 items-center rounded-lg px-2 font-bold underline underline-offset-2">
              Downloads
            </a>
          </div>
        )}
      </header>

      {isSearchOpen && <GlobalSearchModal isOpen onClose={() => setIsSearchOpen(false)} />}
    </>
  );
};

export default Header;
