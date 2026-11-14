"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleAlert, LogIn, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";

// Shown when an API call discovers the session is dead. The alternative is
// failing silently, which is how users end up half-signed-out.
export default function AuthBanner() {
  const { sessionExpired, setSessionExpired, authError } = useAuth();
  const pathname = usePathname();

  if (!sessionExpired && !authError) return null;

  if (authError) {
    return (
      <div
        role="alert"
        className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900"
      >
        <CircleAlert size={14} className="shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">{authError}</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="shrink-0 rounded-full bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-800"
        >
          Retry
        </button>
      </div>
    );
  }

  const redirectTo = encodeURIComponent(pathname && pathname !== "/auth" ? pathname : "/");

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900"
    >
      <CircleAlert size={14} className="shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        Your session expired. Sign in again to keep your changes.
      </span>
      <Link
        href={`/auth?redirectTo=${redirectTo}`}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-800"
      >
        <LogIn size={12} aria-hidden="true" />
        Sign in
      </Link>
      <button
        type="button"
        onClick={() => setSessionExpired(false)}
        aria-label="Dismiss"
        className="shrink-0 rounded-full p-1 text-amber-800 transition hover:bg-amber-100"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
