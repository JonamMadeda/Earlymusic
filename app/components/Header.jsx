"use client";

import { useState, useEffect } from "react";
import { CloudOff } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Playfair_Display } from "next/font/google";

const brandFont = Playfair_Display({ subsets: ["latin"], weight: ["700", "800", "900"] });

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
          <h1 className={`${brandFont.className} text-[26px] font-extrabold italic tracking-tight text-neutral-900 leading-none`}>
            Lumbo
          </h1>
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
