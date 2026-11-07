"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

const CONSENT_KEY = "lumbo_analytics_consent";

export default function AnalyticsConsentBanner() {
  const [consented, setConsented] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(CONSENT_KEY) === "true";
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (consented === true) {
      try {
        window.localStorage.setItem(CONSENT_KEY, "true");
      } catch {}
    }
  }, [consented]);

  const handleAccept = () => setConsented(true);
  const handleDecline = () => setConsented(false);

  // Only render the banner until the user has made a choice.
  if (consented !== null) {
    // If consented, render analytics (client-side only after consent).
    if (consented === true) {
      return (
        <>
          <Analytics />
          <SpeedInsights />
        </>
      );
    }
    return null;
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[1000] flex flex-col md:flex-row items-center justify-between gap-4 p-4 md:p-6 border-t border-neutral-200 bg-white/95 backdrop-blur-xl shadow-lg"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <p className="text-sm text-neutral-700 leading-relaxed">
          We use analytics to understand how listeners use the app and improve
          your experience. No personal data is sold or shared.
        </p>
        <div className="flex flex-col md:flex-row gap-2 text-xs">
          <Link
            href="/terms"
            className="text-accent hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Terms of Service
          </Link>
          <span className="text-neutral-400">•</span>
          <Link
            href="/privacy"
            className="text-accent hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Privacy Policy
          </Link>
        </div>
      </div>
      <div className="flex gap-3 mt-3 md:mt-0">
        <button
          onClick={handleAccept}
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-accent/90 active:scale-95"
        >
          Accept
        </button>
        <button
          onClick={handleDecline}
          className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-xs font-bold text-neutral-600 transition hover:bg-neutral-50 active:scale-95"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
