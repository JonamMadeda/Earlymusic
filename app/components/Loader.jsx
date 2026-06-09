"use client";

import { Disc } from "lucide-react";

const Loader = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full gap-y-6">
      <div className="relative flex items-center justify-center">
        {/* Pulsing background circle - softened color */}
        <div className="absolute h-16 w-16 bg-neutral-100 rounded-full animate-ping opacity-50" />

        {/* Rotating Disc Icon - Simplified shadow */}
        <div className="relative h-16 w-16 bg-white rounded-full flex items-center justify-center shadow-sm border border-neutral-100">
          <Disc className="text-accent animate-spin-slow" size={32} />
        </div>
      </div>

      <div className="flex flex-col items-center gap-y-2">
        {/* Brand Text: Simple Semibold */}
        <p className="text-[14px] font-semibold tracking-tight text-neutral-900">
          earlymusic
        </p>

        {/* Status Text: Simple Medium, no forced caps */}
        <p className="text-[12px] font-medium text-neutral-400 animate-pulse">
          Loading library...
        </p>
      </div>
    </div>
  );
};

export default Loader;
