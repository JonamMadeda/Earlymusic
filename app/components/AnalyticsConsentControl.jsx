"use client";

import Link from "next/link";
import { BarChart3, Check, X } from "lucide-react";
import { setAnalyticsConsent, useAnalyticsConsent } from "@/lib/analyticsConsent";

const STATUS = {
  true: { label: "Analytics on", className: "bg-emerald-50 text-emerald-700" },
  false: { label: "Analytics off", className: "bg-neutral-100 text-neutral-600" },
  null: { label: "Not decided", className: "bg-amber-50 text-amber-700" },
};

/**
 * Withdrawal control for the analytics consent banner. The Privacy Policy
 * promises that consent can be changed at any time, so this is the place that
 * keeps that promise: switching to "off" unmounts the analytics scripts
 * immediately through the shared store.
 */
export default function AnalyticsConsentControl() {
  const consent = useAnalyticsConsent();
  const status = STATUS[String(consent)] ?? STATUS.null;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-neutral-500">
        When on, Vercel Analytics and Speed Insights collect aggregated usage and
        performance data. No personal data is sold or shared. Turning this off
        stops the scripts on your next page load; the App works fully without
        them.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAnalyticsConsent(true)}
          disabled={consent === true}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-accent/90 disabled:opacity-40"
        >
          <Check size={13} aria-hidden="true" />
          Allow analytics
        </button>
        <button
          type="button"
          onClick={() => setAnalyticsConsent(false)}
          disabled={consent === false}
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-xs font-semibold text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900 disabled:opacity-40"
        >
          <X size={13} aria-hidden="true" />
          Turn off
        </button>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-neutral-400">
        <BarChart3 size={12} aria-hidden="true" />
        Read more in the{" "}
        <Link
          href="/privacy#cookies"
          className="font-semibold text-accent hover:underline"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
