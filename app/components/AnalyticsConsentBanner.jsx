"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { BarChart3, Check, ShieldCheck } from "lucide-react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import {
  setAnalyticsConsent,
  useAnalyticsConsent,
} from "@/lib/analyticsConsent";

const subscribeToMount = () => () => {};
const getMounted = () => true;
const getServerMounted = () => false;

export default function AnalyticsConsentBanner() {
  // `null` = undecided (show the dialog), `true`/`false` = a stored choice.
  const consented = useAnalyticsConsent();

  // False during SSR and hydration, true afterwards. Avoids rendering the
  // dialog on the server only to remove it once localStorage is read.
  const mounted = useSyncExternalStore(
    subscribeToMount,
    getMounted,
    getServerMounted
  );

  const acceptRef = useRef(null);
  const isOpen = mounted && consented === null;

  const choose = useCallback((value) => setAnalyticsConsent(value), []);

  // While the dialog is open: close on Escape, lock page scroll and move focus
  // to the primary action.
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") choose(false);
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    acceptRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, choose]);

  if (mounted && consented === true) {
    return (
      <>
        <Analytics />
        <SpeedInsights />
      </>
    );
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="analytics-consent-title"
      aria-describedby="analytics-consent-description"
    >
      {/* Backdrop — clicking it declines, matching the Escape key. */}
      <div
        className="animate-fade-in absolute inset-0 bg-neutral-950/60 backdrop-blur-md"
        onClick={() => choose(false)}
        aria-hidden="true"
      />

      {/* Modal panel — a bottom sheet on phones, a centred card above sm. */}
      <div
        className="animate-modal-in relative flex max-h-[calc(100dvh-0.75rem)] w-full max-w-lg flex-col overflow-y-auto rounded-t-3xl border border-neutral-200 bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-2xl ring-1 ring-black/5 sm:max-h-[calc(100dvh-3rem)] sm:rounded-3xl sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        {/* A restrained brand wash keeps the surface from reading as a plain form. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-32 rounded-t-3xl bg-gradient-to-b from-accent/[0.055] to-transparent"
        />

        <div className="relative">
          {/* Header */}
          <div className="flex items-start gap-3.5 sm:gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-white shadow-sm shadow-accent/20 sm:h-12 sm:w-12">
              <BarChart3 size={21} strokeWidth={2.25} aria-hidden="true" />
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400">
                Your privacy
              </p>
              <h2
                id="analytics-consent-title"
                className="mt-1 text-lg font-bold tracking-tight text-neutral-900 sm:text-xl"
              >
                Help us improve Luumbo
              </h2>
              <p
                id="analytics-consent-description"
                className="mt-1.5 text-sm leading-relaxed text-neutral-500"
              >
                Optional analytics help us make the app faster, steadier, and
                easier to use.
              </p>
            </div>
          </div>

          {/* Privacy assurance */}
          <div className="mt-5 rounded-2xl border border-neutral-200/80 bg-neutral-50/70 p-4 sm:mt-6">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-500 shadow-2xs">
                <ShieldCheck size={16} strokeWidth={2.25} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-900">
                  Your data stays private
                </p>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                  No personal data is sold or shared. We only see aggregated
                  performance and feature-usage signals — nothing that identifies
                  you.
                </p>
              </div>
            </div>
          </div>

          {/* Actions + legal footer */}
          <div className="mt-5 border-t border-neutral-100 pt-4 sm:mt-6 sm:pt-5">
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => choose(false)}
                className="btn-secondary justify-center"
              >
                Decline
              </button>
              <button
                ref={acceptRef}
                type="button"
                onClick={() => choose(true)}
                className="btn-primary justify-center"
              >
                <Check size={15} strokeWidth={3} aria-hidden="true" />
                Allow analytics
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-2 text-[11px] leading-relaxed text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
              <p>
                Change this anytime in{" "}
                <Link
                  href="/settings"
                  className="font-semibold text-neutral-600 underline-offset-2 transition hover:text-accent hover:underline"
                >
                  Settings
                </Link>
                .
              </p>
              <div className="flex items-center gap-3">
                <Link
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-neutral-500 underline-offset-2 transition hover:text-accent hover:underline"
                >
                  Privacy Policy
                </Link>
                <span className="text-neutral-300" aria-hidden="true">
                  •
                </span>
                <Link
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-neutral-500 underline-offset-2 transition hover:text-accent hover:underline"
                >
                  Terms
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
