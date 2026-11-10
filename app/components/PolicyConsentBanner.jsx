"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import {
  LEGAL_PRIVACY_VERSION,
  LEGAL_TERMS_VERSION,
} from "@/lib/legal";

/**
 * Shows when a signed-in account accepted an older version of the Terms or
 * Privacy Policy. Accepting updates the account and logs the consent
 * server-side, so the banner cannot reappear until the next material change.
 */
export default function PolicyConsentBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!user || dismissed) return null;

  const needsTerms = user.terms_version !== LEGAL_TERMS_VERSION;
  const needsPrivacy = user.privacy_version !== LEGAL_PRIVACY_VERSION;
  if (!needsTerms && !needsPrivacy) return null;

  const accept = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/accept-policies", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Unable to record your acceptance.");
      }
      setDismissed(true);
    } catch (acceptError) {
      setError(acceptError.message || "Unable to record your acceptance.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside
      role="dialog"
      aria-label="Updated legal documents"
      className="fixed inset-x-3 bottom-24 z-[900] rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xl md:bottom-28 md:left-auto md:right-6 md:max-w-sm"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <ShieldCheck size={17} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold tracking-tight text-neutral-900">
            We updated our legal documents
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
            Please review the{" "}
            <Link href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
              Privacy Policy
            </Link>{" "}
            and accept them to keep using your account.
          </p>
          {error && (
            <p role="alert" className="mt-2 text-[11px] font-medium text-red-600">
              {error}
            </p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={accept}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-[11px] font-bold text-white transition hover:bg-accent/90 disabled:opacity-50"
            >
              {busy && <Loader2 size={12} className="animate-spin" />}
              Accept and continue
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              disabled={busy}
              className="rounded-full px-3 py-2 text-[11px] font-semibold text-neutral-500 transition hover:bg-neutral-100 disabled:opacity-50"
            >
              Later
            </button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setDismissed(true)}
          disabled={busy}
          className="rounded-lg p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50"
        >
          <X size={15} />
        </button>
      </div>
    </aside>
  );
}
