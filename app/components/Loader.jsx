"use client";

const Loader = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full gap-y-6 bg-neutral-50/60">
      <div className="flex flex-col items-center gap-y-3">
        <p className="text-[14px] font-semibold tracking-tight text-accent">
          lumbo
        </p>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce" />
        </div>
        <p className="text-[12px] font-medium text-neutral-400">
          Loading library...
        </p>
      </div>
    </div>
  );
};

export default Loader;
