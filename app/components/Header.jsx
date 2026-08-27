"use client";

import { useState, useEffect } from "react";
import { CloudOff } from "lucide-react";

const Header = () => {
  const [isOnline, setIsOnline] = useState(true);

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

  if (isOnline) return null;

  return (
    <header className="sticky top-0 z-[200] border-b border-white/70 bg-white/70 px-4 py-2 backdrop-blur-xl md:px-6 md:py-3">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-x-1.5 rounded-full border border-neutral-100 bg-neutral-50 px-2 py-1 animate-pulse">
          <CloudOff size={12} className="text-neutral-500" />
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
            Offline
          </span>
        </div>
      </div>
    </header>
  );
};

export default Header;
