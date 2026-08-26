"use client";

import { useAuth } from "@/app/context/AuthContext";

const GlobalLoader = () => {
  const { loading } = useAuth();

  if (!loading) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-neutral-50/60">
      <div className="flex flex-col items-center gap-3">
        <p className="text-[14px] font-semibold tracking-tight text-accent">lumbo</p>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce" />
        </div>
      </div>
    </div>
  );
};

export default GlobalLoader;
