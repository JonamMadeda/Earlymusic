"use client";

import { useState, useEffect } from "react";
import { Search, Menu, X, Home, Library, ListMusic, LogOut, LogIn, User, CloudOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const { user, signOut } = useAuth();
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
    <header className="sticky top-0 z-[200] bg-white border-b border-neutral-100 px-6 py-5">
      <div className="flex items-center justify-between">
        {/* Title updated to Scarlet color */}
        <div className="flex items-center gap-x-3">
          <Link href="/">
            <h1 className="text-2xl font-black tracking-tighter text-neutral-900 leading-none">
              earlymusic
            </h1>
          </Link>
          {!isOnline && (
            <div className="flex items-center gap-x-1.5 bg-neutral-100 px-2 py-1 rounded-full animate-pulse">
              <CloudOff size={12} className="text-neutral-500" />
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                Offline
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-x-2">
          {/* Desktop auth button */}
          {user ? (
            <button
              onClick={() => { signOut(); router.push("/"); }}
              className="hidden md:flex items-center gap-2 text-neutral-400 hover:text-red-600 transition text-[12px] font-bold uppercase tracking-wider px-3 py-1.5"
              title="Sign Out"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          ) : (
            <button
              onClick={() => router.push("/auth")}
              className="hidden md:flex items-center gap-2 bg-red-600 text-white px-4 py-1.5 rounded-xl font-bold text-[12px] hover:bg-neutral-900 transition shadow-lg shadow-red-100"
            >
              <LogIn size={14} />
              Sign In
            </button>
          )}

          {/* Search Button - Now opens the search page on mobile */}
          <button
            onClick={() => router.push("/search")}
            className="md:hidden p-2 hover:bg-neutral-100 rounded-full transition"
            aria-label="Open Search"
          >
            <Search size={22} className="text-neutral-900" />
          </button>

          {/* Menu Toggle - Mobile Only */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 hover:bg-neutral-100 rounded-full transition"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-neutral-100 shadow-xl animate-in slide-in-from-top duration-200">
          <nav className="flex flex-col p-4 gap-y-2">
            <Link
              href="/"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-x-3 p-4 bg-neutral-50 rounded-xl text-red-600 font-bold"
            >
              <Home size={20} />
              <span className="uppercase text-sm tracking-tight">Home</span>
            </Link>
            <Link
              href="/playlists"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-x-3 p-4 hover:bg-neutral-50 rounded-xl text-neutral-600 font-bold transition"
            >
              <ListMusic size={20} />
              <span className="uppercase text-sm tracking-tight">Playlists</span>
            </Link>
            <Link
              href="/library"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-x-3 p-4 hover:bg-neutral-50 rounded-xl text-neutral-600 font-bold transition"
            >
              <Library size={20} />
              <span className="uppercase text-sm tracking-tight">Library</span>
            </Link>
            <div className="border-t border-neutral-100 my-2" />
            {user ? (
              <button
                onClick={() => { signOut(); setIsMenuOpen(false); router.push("/"); }}
                className="flex items-center gap-x-3 p-4 hover:bg-neutral-50 rounded-xl text-neutral-600 font-bold transition w-full"
              >
                <LogOut size={20} />
                <span className="uppercase text-sm tracking-tight">Sign Out</span>
              </button>
            ) : (
              <Link
                href="/auth"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-x-3 p-4 hover:bg-neutral-50 rounded-xl text-neutral-600 font-bold transition"
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
