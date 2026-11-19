"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { useOnlineStatus } from "@/lib/useOnlineStatus";
import { CloudOff, LogIn, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import GlobalSearchModal from "./GlobalSearchModal";
import NotificationBell from "./NotificationBell";

const sectionNames = {
  songs: "Songs", library: "Library", playlists: "Playlists", account: "Account",
  notifications: "Notifications", auth: "Welcome", admin: "Admin", upload: "Upload",
  settings: "Settings", search: "Search", privacy: "Privacy", terms: "Terms",
  accessibility: "Accessibility", downloads: "Downloads",
};

const subscribePlatform = () => () => {};

const Header = () => {
  const pathname = usePathname();
  const isOnline = useOnlineStatus();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const isApple = useSyncExternalStore(subscribePlatform, () => /Mac|iPhone|iPad/.test(navigator.platform), () => false);
  const shortcut = isApple ? "⌘ K" : "Ctrl K";
  const isHomePage = pathname === "/";
  const { user, loading: authLoading } = useAuth();
  const showSignIn = isOnline && !authLoading && !user && pathname !== "/auth";
  const sectionName = sectionNames[pathname?.split("/")[1]] || "Luumbo";

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!e.defaultPrevented && !e.repeat && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <header className="relative z-[200] shrink-0 border-b border-neutral-200/70 bg-white">
        <div className="mx-auto flex min-h-11 items-center justify-between gap-3 px-3 py-1.5 sm:px-6 md:min-h-14 md:px-8 md:py-2.5">
          <div className="flex min-w-0 flex-1 items-center">
            <Link href="/" aria-label="Luumbo home" className="tap-sm inline-flex h-8.5 shrink-0 items-center rounded-md md:hidden">
              <span className="text-[18px] leading-none font-bold tracking-tight text-neutral-900">
                Luumbo
              </span>
            </Link>
            {isHomePage ? (
              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={isSearchOpen}
                onClick={() => setIsSearchOpen(true)}
                className="tap-sm hidden min-h-9 w-full max-w-sm items-center gap-2.5 rounded-full border border-neutral-200 bg-neutral-50 px-3.5 py-1.5 text-sm text-neutral-500 transition hover:border-neutral-300 hover:bg-neutral-100 md:flex"
              >
                <Search size={16} className="shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-left">Search songs, artists...</span>
                <kbd className="shrink-0 rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-neutral-500">
                  {shortcut}
                </kbd>
              </button>
            ) : (
              <span className="hidden truncate text-sm font-semibold text-neutral-600 md:block">{sectionName}</span>
            )}
          </div>
          <nav aria-label="Quick access" className="flex shrink-0 items-center gap-2 md:hidden">
            {isHomePage && (
              <button
                type="button"
                aria-label="Search songs and artists"
                aria-haspopup="dialog"
                aria-expanded={isSearchOpen}
                onClick={() => setIsSearchOpen(true)}
                className="tap-sm flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition hover:bg-neutral-200 active:scale-95"
              >
                <Search size={18} aria-hidden="true" />
              </button>
            )}
            <NotificationBell />
            {showSignIn && (
              <Link
                href={`/auth?redirectTo=${encodeURIComponent(pathname || "/")}`}
                className="tap-sm inline-flex min-h-8.5 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-white transition hover:bg-accent/90 active:scale-95"
              >
                <LogIn size={14} aria-hidden="true" />
                Sign in
              </Link>
            )}
          </nav>
        </div>
        {/* Offline is a state of the whole app, separate from navigation. */}
        {!isOnline && (
          <div role="status" className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 sm:px-6 md:px-8">
            <CloudOff size={14} aria-hidden="true" className="shrink-0" />
            <span className="min-w-0 flex-1">Offline — downloaded songs are available.</span>
            <Link href="/library?tab=downloads" className="tap-sm inline-flex shrink-0 items-center rounded-lg px-2 font-bold underline underline-offset-2">
              Downloads
            </Link>
          </div>
        )}
      </header>
      {isSearchOpen && <GlobalSearchModal isOpen onClose={() => setIsSearchOpen(false)} />}
    </>
  );
};

export default Header;
