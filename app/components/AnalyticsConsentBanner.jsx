"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { BarChart3, ShieldCheck } from "lucide-react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

const CONSENT_KEY = "lumbo_analytics_consent";

/**
 * Consent lives in localStorage but is exposed to React through a tiny
 * external store. This keeps the server snapshot ("undecided") and the client
 * snapshot in sync, so hydration never leaves a stale, inert dialog on screen.
 */
const listeners = new Set();
let memoryConsent = null;

function readStoredConsent() {
  if (memoryConsent !== null) return memoryConsent;
  try {
    const stored = window.localStorage.getItem(CONSENT_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
  } catch {
    // localStorage can throw in private mode or when blocked by the browser.
  }
  return null;
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function storeConsent(value) {
  memoryConsent = value;
  try {
    window.localStorage.setItem(CONSENT_KEY, value ? "true" : "false");
  } catch {}
  listeners.forEach((listener) => listener());
}

const getServerConsent = () => null;
const subscribeToMount = () => () => {};
const getMounted = () => true;
const getServerMounted = () => false;

export default function AnalyticsConsentBanner() {
  // `null` = undecided (show the dialog), `true`/`false` = a stored choice.
  const consented = useSyncExternalStore(
    subscribe,
    readStoredConsent,
    getServerConsent
  );

  // False during SSR and hydration, true afterwards. Avoids rendering the
  // dialog on the server only to remove it once localStorage is read.
  const mounted = useSyncExternalStore(
    subscribeToMount,
    getMounted,
    getServerMounted
  );

  const acceptRef = useRef(null);
  const isOpen = mounted && consented === null;

  const choose = useCallback((value) => storeConsent(value), []);

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
      className="fixed inset-0 z-[10050] flex items-end justify-center p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="analytics-consent-title"
      aria-describedby="analytics-consent-description"
    >
      {/* Backdrop — clicking it declines, matching the Escape key. */}
      <div
        className="absolute inset-0 bg-neutral-950/50 backdrop-blur-sm"
        onClick={() => choose(false)}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div
        className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl ring-1 ring-black/5 sm:max-h-[calc(100dvh-3rem)] sm:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent sm:h-11 sm:w-11">
            <BarChart3 size={20} strokeWidth={2.5} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2
              id="analytics-consent-title"
              className="text-base font-bold tracking-tight text-neutral-900 sm:text-lg"
            >
              Help us improve Luumbo
            </h2>
            <p
              id="analytics-consent-description"
              className="mt-1 text-sm leading-relaxed text-neutral-500"
            >
              We&rsquo;d like to use analytics to understand how listeners use
              the app and make it better.
            </p>
          </div>
        </div>

        {/* Details */}
        <div className="mt-5 flex items-start gap-3 rounded-xl bg-neutral-50 p-3.5">
          <ShieldCheck
            size={18}
            strokeWidth={2.5}
            className="mt-0.5 shrink-0 text-neutral-400"
            aria-hidden="true"
          />
          <div className="min-w-0 text-sm leading-relaxed text-neutral-600">
            <p className="font-semibold text-neutral-800">
              No personal data is sold or shared.
            </p>
            <p className="mt-1">
              Analytics only helps us improve performance, fix bugs, and
              understand which features listeners use most. You can decline and
              the app will still work fully.
            </p>
          </div>
        </div>

        {/* Legal links */}
        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <Link
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent hover:underline"
          >
            Terms of Service
          </Link>
          <span className="text-neutral-300" aria-hidden="true">
            •
          </span>
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent hover:underline"
          >
            Privacy Policy
          </Link>
        </div>

        {/* Actions */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => choose(false)}
            className="flex min-h-11 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold text-neutral-600 shadow-sm transition-colors hover:bg-neutral-50 hover:text-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98]"
          >
            Decline
          </button>
          <button
            ref={acceptRef}
            type="button"
            onClick={() => choose(true)}
            className="flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98]"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
