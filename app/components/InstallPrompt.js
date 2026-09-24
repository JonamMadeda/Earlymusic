"use client";

import { useState, useEffect } from "react";
import { Download, X, Share, MoreVertical } from "lucide-react";

const DISMISS_KEY = "luumbo-install-dismissed";
const DISMISS_DAYS = 7;

const isDismissed = () => {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
};

const dismiss = () => {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {}
};

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  window.navigator.standalone === true ||
  document.referrer.includes("android-app://");

const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const isAndroid = () => /android/i.test(navigator.userAgent);

const isInApp = () =>
  /instagram|fbav|fban|fbios|tiktok|musical_ly|line\/|micromessenger|whatsapp|telegram|snapchat/i.test(
    navigator.userAgent
  );

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [manualMode, setManualMode] = useState(null); // 'ios' | 'android' | 'inapp' | null
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isDismissed() || isStandalone()) return;

    const handler = (e) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Fallback for browsers that never fire beforeinstallprompt (iOS Safari,
    // Firefox Android, in-app webviews): show manual steps after a short delay
    // so the Chromium prompt still wins where available.
    const t = setTimeout(() => {
      setDeferredPrompt((cur) => {
        if (cur) return cur;
        if (isInApp()) setManualMode("inapp");
        else if (isIOS()) setManualMode("ios");
        else if (isAndroid()) setManualMode("android");
        else return cur;
        setIsVisible(true);
        return cur;
      });
    }, 2500);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(t);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      console.log("User accepted the install prompt");
    }

    setDeferredPrompt(null);
    handleDismiss();
  };

  const handleDismiss = () => {
    dismiss();
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[10000] w-[92%] max-w-md animate-fade-in">
      <div className="bg-white border border-neutral-100 shadow-2xl rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4 sm:gap-x-4">
        <div className="flex items-center gap-x-3 w-full sm:w-auto">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-accent rounded-xl flex items-center justify-center text-white font-bold text-base sm:text-lg shrink-0 shadow-sm">
            LU
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-neutral-900">
              Install Luumbo
            </h3>
            <p className="text-xs text-neutral-500">
              {deferredPrompt
                ? "Listen anywhere, anytime."
                : manualMode === "ios"
                  ? "Tap Share then Add to Home Screen."
                  : manualMode === "inapp"
                    ? "Open in Chrome or Safari to install."
                    : "Tap menu then Add to Home Screen."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-x-2 w-full sm:w-auto">
          {deferredPrompt ? (
            <button
              onClick={handleInstallClick}
              className="flex-1 sm:flex-none bg-accent text-white text-xs font-bold px-4 py-2.5 rounded-lg hover:bg-accent/90 transition-colors inline-flex items-center justify-center gap-x-2"
            >
              <Download size={14} />
              Install
            </button>
          ) : manualMode === "ios" ? (
            <span className="flex-1 sm:flex-none bg-neutral-100 text-neutral-900 text-xs font-bold px-4 py-2.5 rounded-lg inline-flex items-center justify-center gap-x-2">
              <Share size={14} />
              Share → Add to Home Screen
            </span>
          ) : (
            <span className="flex-1 sm:flex-none bg-neutral-100 text-neutral-900 text-xs font-bold px-4 py-2.5 rounded-lg inline-flex items-center justify-center gap-x-2">
              <MoreVertical size={14} />
              Menu → Add to Home Screen
            </span>
          )}
          <button
            onClick={handleDismiss}
            aria-label="Dismiss install prompt"
            className="p-2 text-neutral-400 hover:text-neutral-900 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
