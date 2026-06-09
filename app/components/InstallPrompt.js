"use client";

import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Unregister any leftover service workers from next-pwa
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
    }

    const handler = (e) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
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
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[10000] w-[90%] max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white border border-neutral-100 shadow-2xl rounded-2xl p-4 flex items-center justify-between gap-x-4">
        <div className="flex items-center gap-x-3">
          <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center text-white font-bold text-xl shrink-0">
            EM
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">
              Install Early Music
            </h3>
            <p className="text-xs text-neutral-500">
              Listen anywhere, anytime.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-x-2">
          <button
            onClick={handleInstallClick}
            className="bg-neutral-900 text-white text-xs font-bold px-4 py-2.5 rounded-lg hover:bg-red-600 transition-colors flex items-center gap-x-2"
          >
            <Download size={14} />
            Install
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="p-2 text-neutral-400 hover:text-neutral-900 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
