"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, BarChart3 } from "lucide-react";
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
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="analytics-consent-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal panel */}
      <div className="relative w-full max-w-md mx-auto p-6 md:p-8 rounded-3xl bg-white border border-neutral-100 shadow-xl">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <BarChart3 size={22} />
            </div>
            <div>
              <h2 id="analytics-consent-title" className="text-lg font-bold tracking-tight text-neutral-900">
                Help us improve Luumbo
              </h2>
              <p className="mt-0.5 text-sm text-neutral-500">
                We&rsquo;d like to use analytics to understand how listeners use
                the app and make it better.
              </p>
            </div>
          </div>

          {/* Details */}
          <div className="flex items-start gap-3 text-sm text-neutral-600 leading-relaxed">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-neutral-400" />
            <div>
              <p className="font-medium text-neutral-800">
                No personal data is sold or shared.
              </p>
              <p className="mt-0.5 text-[12px]">
                Analytics only helps us improve performance, fix bugs, and
                understand which features listeners use most. You can decline
                and the app will still work fully.
              </p>
            </div>
          </div>

          {/* Links row */}
          <div className="flex items-center justify-end gap-2 text-xs">
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline font-medium"
            >
              Privacy Policy
            </Link>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleDecline}
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-6 py-3 text-sm font-bold text-neutral-600 transition-all shadow-sm hover:bg-neutral-50 active:scale-95"
            >
              Decline
            </button>
            <button
              onClick={handleAccept}
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-accent/90 active:scale-95"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
