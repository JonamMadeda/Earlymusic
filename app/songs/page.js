import { Suspense } from "react";
import { PageSkeleton } from "../components/Skeleton";
import SongsView from "./songs-view";

// The list itself is read from the query string, so it has to sit behind a
// boundary for the static build to prerender this route (same shape as
// /library). The fallback is the skeleton the page already showed while the
// catalogue loaded, so nothing about first paint changes.
export default function SongsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[90vh] bg-white px-3 pt-3 sm:px-6 md:px-8 md:pt-5">
          <div className="mx-auto max-w-5xl pt-5">
            <PageSkeleton />
          </div>
        </main>
      }
    >
      <SongsView />
    </Suspense>
  );
}
