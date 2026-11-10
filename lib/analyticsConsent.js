"use client";

import { useSyncExternalStore } from "react";
import { LEGAL_PRIVACY_VERSION } from "@/lib/legal";

export const ANALYTICS_CONSENT_KEY = "lumbo_analytics_consent";

/**
 * The consent choice is stored in localStorage but read through an external
 * store so the banner, the settings control, and the analytics scripts all
 * agree immediately when the choice changes. `null` means "not decided yet".
 */
const listeners = new Set();
let memoryConsent = null;

function readStoredConsent() {
  if (memoryConsent !== null) return memoryConsent;
  try {
    const stored = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
  } catch {
    // localStorage can throw in private mode or when blocked by the browser.
  }
  return null;
}

export function subscribeAnalyticsConsent(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getAnalyticsConsentSnapshot = () => readStoredConsent();

// The server cannot read localStorage, so it always renders "undecided" and
// the client fills the real choice in after hydration.
export const getServerAnalyticsConsent = () => null;

export function setAnalyticsConsent(value) {
  memoryConsent = value;
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value ? "true" : "false");
  } catch {}
  listeners.forEach((listener) => listener());

  // Keep an append-only server-side record of the choice. Failure is silent:
  // the local value already governs whether analytics runs.
  try {
    fetch("/api/consent", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        kind: "analytics",
        granted: Boolean(value),
        policy_version: LEGAL_PRIVACY_VERSION,
      }),
    }).catch(() => {});
  } catch {}
}

export function useAnalyticsConsent() {
  return useSyncExternalStore(
    subscribeAnalyticsConsent,
    getAnalyticsConsentSnapshot,
    getServerAnalyticsConsent
  );
}
