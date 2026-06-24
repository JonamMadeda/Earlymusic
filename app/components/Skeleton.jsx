"use client";

const Skeleton = ({ className = "" }) => (
  <div className={`animate-pulse rounded-2xl bg-neutral-100/80 ${className}`} />
);

export const SongRowSkeleton = () => (
  <div className="flex items-center gap-2.5 md:gap-3.5 rounded-2xl p-2.5 md:p-3.5">
    <Skeleton className="h-10 w-10 md:h-12 md:w-12 rounded-xl" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-3 w-2/5" />
    </div>
    <Skeleton className="h-9 w-9 rounded-full" />
  </div>
);

export const SongCardSkeleton = ({ vertical = false }) => {
  if (vertical) {
    return (
      <div className="flex w-[140px] md:w-[170px] flex-col items-center gap-2.5 rounded-xl border border-neutral-100 bg-white p-3.5 md:p-4">
        <Skeleton className="h-12 w-12 md:h-14 md:w-14 rounded-xl" />
        <div className="w-full space-y-2 text-center">
          <Skeleton className="h-3 w-4/5 mx-auto" />
          <Skeleton className="h-2.5 w-3/5 mx-auto" />
        </div>
        <Skeleton className="h-7 w-7 md:h-8 md:w-8 rounded-full" />
      </div>
    );
  }
  return (
    <div className="flex w-[76vw] md:w-[290px] items-center gap-3.5 rounded-2xl p-3.5">
      <Skeleton className="h-12 w-12 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
      <Skeleton className="h-9 w-9 rounded-full" />
    </div>
  );
};

export const LetterGroupSkeleton = () => (
  <div className="flex flex-col gap-y-3">
    <div className="flex items-center gap-x-4 border-b border-neutral-100 pb-2 px-2">
      <Skeleton className="h-8 w-6" />
    </div>
    <div className="flex flex-col gap-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <SongRowSkeleton key={i} />
      ))}
    </div>
  </div>
);

export const PageSkeleton = ({ letterGroups = 2 }) => (
  <main className="min-h-[90vh] bg-transparent px-4 pb-40 pt-2 md:px-8 md:pt-6">
    <div className="max-w-5xl mx-auto">
      <div className="mb-8 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-1 rounded-full" />
          <Skeleton className="h-7 w-40" />
        </div>
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex flex-col gap-y-6">
        {Array.from({ length: letterGroups }).map((_, i) => (
          <LetterGroupSkeleton key={i} />
        ))}
      </div>
    </div>
  </main>
);

export default Skeleton;