"use client";

import { useState, useEffect } from "react";
import { CloudOff, Search } from "lucide-react";
import Link from "next/link";
import GlobalSearchModal from "./GlobalSearchModal";

const Header = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

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

            {/* Desktop quick search button */}
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
          </div>

          {/* Right side: Mobile search button + Offline indicator */}
          <div className="flex items-center gap-2">
            {/* Mobile search button */}
            <button
              type="button"
              aria-label="Search"
              onClick={() => setIsSearchOpen(true)}
              className="flex md:hidden h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 active:scale-95 transition"
            >
              <Search size={16} />
            </button>

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

      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
};

export default Header;
