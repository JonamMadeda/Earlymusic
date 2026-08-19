"use client";

import { useState, useEffect } from "react";
import { CloudOff } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const Header = () => {
  const [isOnline, setIsOnline] = useState(true);
  const pathname = usePathname();

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

  // Hide header on homepage
  if (pathname === "/") return null;

  return (
    <header className="sticky top-0 z-[200] border-b border-white/70 bg-white/70 px-4 py-2 backdrop-blur-xl md:px-6 md:py-3">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="md:hidden">
          <span className="flex items-center gap-2.5">
            <img
              src="/icons/icon-192x192.png"
              alt="Early Music"
              className="h-9 w-9 rounded-xl object-cover shadow-sm shadow-accent/10"
            />
            <h1 className="text-[15px] font-black tracking-tight text-neutral-900 leading-none md:text-[17px]">
              Early Music
            </h1>
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
        </div>
      </div>
    </header>
  );
};

export default Header;
