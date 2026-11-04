"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { CloudOff, LogIn, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import GlobalSearchModal from "./GlobalSearchModal";

const subscribeToOnlineStatus = (onChange) => {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
};

const Header = () => {
  const pathname = usePathname();
  const isOnline = useSyncExternalStore(
    subscribeToOnlineStatus,
    () => navigator.onLine,
    () => true
  );
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
  const showSignIn = !authLoading && !user && pathname !== "/auth";

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
      <header className="sticky top-0 z-[200] border-b border-neutral-100 bg-white/90 px-4 py-2.5 backdrop-blur-xl md:px-6 md:py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Mobile brand / Desktop search trigger */}
          <div className="flex items-center gap-3">
            <Link href="/" className="md:hidden flex items-center">
              <span className="text-base font-bold tracking-tight text-neutral-900">
                Luumbo
              </span>
            </Link>

            {/* Desktop quick search button (home page only) */}
            {isHomePage && (
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="hidden md:flex items-center gap-2.5 rounded-full border border-neutral-200 bg-neutral-50/80 px-3.5 py-1.5 text-xs text-neutral-400 hover:border-neutral-300 hover:bg-neutral-100/80 hover:text-neutral-700 transition shadow-sm w-64 lg:w-80"
              >
                <Search size={14} className="text-neutral-400" />
                <span className="flex-1 text-left">Search songs, artists...</span>
                <kbd className="rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-neutral-400">
                  ⌘K
                </kbd>
              </button>
            )}
          </div>

          {/* Right side: Mobile search button + Offline indicator */}
          <div className="flex items-center gap-2">
            {/* Mobile search button (home page only) */}
            {isHomePage && (
              <button
                type="button"
                aria-label="Search"
                onClick={() => setIsSearchOpen(true)}
                className="flex md:hidden h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 active:scale-95 transition"
              >
                <Search size={16} />
              </button>
            )}

            {showSignIn && (
              <Link
                href={`/auth?redirectTo=${encodeURIComponent(pathname || "/")}`}
                className="md:hidden inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-white shadow-sm transition active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                <LogIn size={13} aria-hidden="true" />
                Sign in
              </Link>
            )}

            {!isOnline && (
              <div className="flex items-center gap-x-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 animate-pulse">
                <CloudOff size={12} className="text-amber-700" />
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                  Offline
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {isSearchOpen && <GlobalSearchModal isOpen onClose={() => setIsSearchOpen(false)} />}
    </>
  );
};

export default Header;
