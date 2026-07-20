"use client";

import { useState, useEffect } from "react";
import { Menu, X, Home, Library, ListMusic, LogOut, LogIn, CloudOff, Music, User, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const { user, signOut, isAdmin } = useAuth();
  const router = useRouter();

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

  return (
    <header className="sticky top-0 z-[200] border-b border-white/70 bg-white/70 px-4 py-2 backdrop-blur-xl md:px-6 md:py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-x-3">
          <Link href="/" className="md:hidden">
            <span className="flex items-center gap-3">
<span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-sm font-black tracking-tight text-white shadow-lg shadow-accent/15">
                EM
              </span>
              <span className="flex flex-col">
                <h1 className="text-[18px] font-black tracking-[-0.05em] text-neutral-900 leading-none md:text-[20px]">
                  earlymusic
                </h1>
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-neutral-400">
                  curated songs
                </span>
              </span>
            </span>
          </Link>
          {!isOnline && (
            <div className="flex items-center gap-x-1.5 rounded-full border border-neutral-100 bg-neutral-50 px-2 py-1 animate-pulse">
              <CloudOff size={12} className="text-neutral-500" />
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                Offline
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-x-2">
          {/* Desktop auth button - only show Sign In when not authenticated */}
          {!user && (
            <button
              onClick={() => router.push("/auth")}
              className="hidden md:flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-[12px] font-bold text-white shadow-sm transition hover:bg-accent/90"
            >
              <LogIn size={14} />
              Sign In
            </button>
          )}

          {/* Menu Toggle - Mobile Only */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden rounded-full p-2.5 transition hover:bg-neutral-100"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {isMenuOpen && (
        <div className="absolute left-0 right-0 top-full border-b border-white/70 bg-white/90 shadow-xl backdrop-blur-xl md:hidden">
          <nav className="flex flex-col gap-y-2 p-4">
            <Link
              href="/"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-x-3 rounded-2xl border border-accent/15 bg-accent/10 p-4 font-bold text-accent"
            >
              <Home size={20} />
              <span className="uppercase text-sm tracking-tight">Home</span>
            </Link>
            <Link
              href="/songs"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-x-3 rounded-2xl border border-transparent p-4 font-bold text-neutral-600 transition hover:border-neutral-100 hover:bg-neutral-50"
            >
              <Music size={20} />
              <span className="uppercase text-sm tracking-tight">Songs</span>
            </Link>
            <Link
              href="/playlists"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-x-3 rounded-2xl border border-transparent p-4 font-bold text-neutral-600 transition hover:border-neutral-100 hover:bg-neutral-50"
            >
              <ListMusic size={20} />
              <span className="uppercase text-sm tracking-tight">Playlists</span>
            </Link>
            <Link
              href="/library"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-x-3 rounded-2xl border border-transparent p-4 font-bold text-neutral-600 transition hover:border-neutral-100 hover:bg-neutral-50"
            >
              <Library size={20} />
              <span className="uppercase text-sm tracking-tight">Library</span>
            </Link>
            {user && (
              <Link
                href="/account"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-x-3 rounded-2xl border border-transparent p-4 font-bold text-neutral-600 transition hover:border-neutral-100 hover:bg-neutral-50"
              >
                <User size={20} />
                <span className="uppercase text-sm tracking-tight">Account</span>
              </Link>
            )}
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-x-3 rounded-2xl border border-transparent p-4 font-bold text-neutral-600 transition hover:border-neutral-100 hover:bg-neutral-50"
              >
                <ShieldCheck size={20} />
                <span className="uppercase text-sm tracking-tight">Admin</span>
              </Link>
            )}
            <div className="my-2 border-t border-neutral-100" />
            {user ? (
              <button
                onClick={() => { signOut(); setIsMenuOpen(false); router.push("/"); }}
                className="flex w-full items-center gap-x-3 rounded-2xl border border-transparent p-4 font-bold text-neutral-600 transition hover:border-neutral-100 hover:bg-neutral-50"
              >
                <LogOut size={20} />
                <span className="uppercase text-sm tracking-tight">Sign Out</span>
              </button>
            ) : (
              <Link
                href="/auth"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-x-3 rounded-2xl border border-transparent p-4 font-bold text-neutral-600 transition hover:border-neutral-100 hover:bg-neutral-50"
              >
                <LogIn size={20} />
                <span className="uppercase text-sm tracking-tight">Sign In</span>
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
