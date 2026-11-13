"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { BarChart3, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import {
  setAnalyticsConsent,
  useAnalyticsConsent,
} from "@/lib/analyticsConsent";

const subscribeToMount = () => () => {};
const getMounted = () => true;
const getServerMounted = () => false;

const BENEFITS = [
  {
    icon: ShieldCheck,
    title: "Your privacy comes first",
    body: "Only aggregated, anonymous usage data. Nothing is sold or shared.",
  },
  {
    icon: Sparkles,
    title: "Better with every listen",
    body: "Insights help us fix bugs, speed up playback and improve the features you use most.",
  },
  {
    icon: CheckCircle2,
    title: "Always your choice",
    body: "Decline and the app still works fully. Change your mind anytime in your account or Settings.",
  },
];

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

  const dialogRef = useRef(null);
  const acceptRef = useRef(null);
  const isOpen = mounted && consented === null;

  const choose = useCallback((value) => setAnalyticsConsent(value), []);

  // Escape declines, Tab is trapped inside, scroll locks, and focus returns
  // to the opener on close.
  useEffect(() => {
    if (!isOpen) return;

    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    acceptRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        choose(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusables = dialogRef.current?.querySelectorAll(
        "button:not([disabled]), [href]"
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (opener instanceof HTMLElement && document.contains(opener)) {
        opener.focus();
      }
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
        className="animate-fade-in absolute inset-0 bg-neutral-950/60 backdrop-blur-sm"
        onClick={() => choose(false)}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        className="animate-modal-in relative flex w-full max-w-md flex-col rounded-3xl border border-neutral-200/80 bg-white p-5 shadow-[0_24px_70px_-24px_rgba(15,23,42,0.45)] sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/[0.06] text-accent ring-1 ring-accent/10">
            <BarChart3 size={22} strokeWidth={2} aria-hidden="true" />
          </div>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">
            Privacy-first analytics
          </p>
          <h2
            id="analytics-consent-title"
            className="mt-1 text-xl font-bold tracking-tight text-neutral-900"
          >
            Help us improve Luumbo
          </h2>
          <p
            id="analytics-consent-description"
            className="mt-1.5 text-sm leading-relaxed text-neutral-500"
          >
            Allow anonymous analytics so we can understand how listeners use
            the app and make every release better.
          </p>
        </div>

        <ul className="mt-4 space-y-2">
          {BENEFITS.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="flex items-start gap-3 rounded-2xl border border-neutral-100 bg-neutral-50/70 p-3"
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-accent shadow-sm ring-1 ring-neutral-200/70">
                <Icon size={14} strokeWidth={2.25} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-neutral-800">
                  {title}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">
                  {body}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-5 grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2">
          <button
            type="button"
            onClick={() => choose(false)}
            className="btn-secondary order-2 w-full min-[420px]:order-1"
          >
            Decline
          </button>
          <button
            ref={acceptRef}
            type="button"
            onClick={() => choose(true)}
            className="btn-primary order-1 w-full min-[420px]:order-2"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
