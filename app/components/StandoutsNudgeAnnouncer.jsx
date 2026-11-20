"use client";

import { useLibraryNudge } from "@/lib/libraryNudge";

/**
 * The dot is a visual cue on the nav; screen reader users get the same signal
 * through a live region that updates when the dot appears or disappears.
 */
export default function StandoutsNudgeAnnouncer() {
  const { active, reasonLabel } = useLibraryNudge();
  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {active ? `New ${reasonLabel} in the Library.` : ""}
    </div>
  );
}
