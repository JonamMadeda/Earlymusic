"use client";

import { useState, useEffect } from "react";
import { LogIn, CloudOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { pastelGradient } from "./SongAvatar";

const Header = () => {
  const [isOnline, setIsOnline] = useState(true);
  const { user } = useAuth();
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
        <Link href="/" className="md:hidden">
          <span className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[11px] font-bold text-white shadow-sm"
              style={{ background: pastelGradient("earlymusic") }}
            >
              EM
            </span>
            <span className="flex flex-col">
              <h1 className="text-base font-bold tracking-tight text-neutral-900 leading-none">
                Early Music
              </h1>
              <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                curated songs
              </span>
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-x-2">
          {!isOnline && (
            <div className="flex items-center gap-x-1.5 rounded-full border border-neutral-100 bg-neutral-50 px-2 py-1 animate-pulse">
              <CloudOff size={12} className="text-neutral-500" />
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                Offline
              </span>
            </div>
          )}
          {!user && (
            <button
              onClick={() => router.push("/auth")}
              className="hidden md:flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-[12px] font-bold text-white shadow-sm transition hover:bg-accent/90"
            >
              <LogIn size={14} />
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
