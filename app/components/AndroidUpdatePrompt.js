"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import BrandMark from "@/app/components/BrandMark";
import {
  UPDATE_RECORD_KEY,
  acknowledgeRecord,
  decideInstallerBanner,
  isAndroidInstallerHost,
  readRecord,
} from "@/lib/androidUpdate";

const store = (value) => {
  try {
    localStorage.setItem(UPDATE_RECORD_KEY, value);
  } catch {}
};

export default function AndroidUpdatePrompt() {
  const [offer, setOffer] = useState(null);

  useEffect(() => {
    if (
      !isAndroidInstallerHost({
        userAgent: window.navigator.userAgent,
        standalone:
          window.matchMedia?.("(display-mode: standalone)").matches ||
          window.navigator.standalone === true,
      })
    ) {
      return;
    }

    let cancelled = false;

    const check = async () => {
      let release;
      try {
        const response = await fetch("/android-latest.json", { cache: "no-store" });
        if (!response.ok) return;
        release = await response.json();
      } catch {
        return; // Offline or not deployed yet: show nothing rather than a dead link.
      }
      if (cancelled) return;

      const decision = decideInstallerBanner({
        release,
        record: readRecord(localStorage.getItem(UPDATE_RECORD_KEY)),
        eligible: true,
      });

      // The record is written before the banner renders, so a crash mid-paint
      // cannot turn one published version into an endless prompt.
      if (decision.record) store(decision.record);

      if (decision.action === "offer") {
        setOffer({
          versionName: decision.versionName,
          apkUrl: decision.apkUrl,
          releaseUrl: decision.releaseUrl,
        });
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!offer) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[10000] w-[92%] max-w-md animate-fade-in">
      <div className="bg-white border border-neutral-100 shadow-2xl rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4 sm:gap-x-4">
        <div className="flex items-center gap-x-3 w-full sm:w-auto">
          <BrandMark className="h-10 w-10 sm:h-12 sm:w-12" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-neutral-900">
              Update Luumbo
            </h3>
            <p className="text-xs text-neutral-500">
              Version {offer.versionName} of the Android app is available.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-x-2 w-full sm:w-auto">
          <a
            href={offer.apkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 sm:flex-none bg-accent text-white text-xs font-bold px-4 py-2.5 rounded-lg hover:bg-accent/90 transition-colors inline-flex items-center justify-center gap-x-2"
          >
            <Download size={14} />
            Download
          </a>
          <button
            onClick={() => {
              store(acknowledgeRecord(offer.versionName));
              setOffer(null);
            }}
            aria-label="Dismiss update prompt"
            className="p-2 text-neutral-400 hover:text-neutral-900 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
