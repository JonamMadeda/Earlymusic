"use client";

import { useAuth } from "@/app/context/AuthContext";

const GlobalLoader = () => {
  const { loading } = useAuth();

  if (!loading) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <img
          src="/icons/icon-192x192.png"
          alt="Early Music"
          className="h-16 w-16 rounded-2xl object-cover shadow-lg shadow-accent/20 animate-pulse"
        />
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-accent animate-bounce [animation-delay:-0.3s]" />
          <span className="h-2 w-2 rounded-full bg-accent animate-bounce [animation-delay:-0.15s]" />
          <span className="h-2 w-2 rounded-full bg-accent animate-bounce" />
        </div>
      </div>
    </div>
  );
};

export default GlobalLoader;
