"use client";

import { useState, useEffect } from "react";
import { Search, Menu, X, Home, Library, CloudOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
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
    <header className="sticky top-0 z-[200] bg-white border-b border-neutral-200 px-6 py-5">
      <div className="flex items-center justify-between">
        {/* Title updated to Scarlet color */}
        <div className="flex items-center gap-x-3">
          <Link href="/">
            <h1 className="text-2xl font-black tracking-tighter uppercase text-neutral-900 leading-none">
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
              href="/library"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-x-3 p-4 hover:bg-neutral-50 rounded-xl text-neutral-600 font-bold transition"
            >
              <Library size={20} />
              <span className="uppercase text-sm tracking-tight">Library</span>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
