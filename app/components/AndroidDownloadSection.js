"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Download, Link2, MonitorSmartphone } from "lucide-react";
import { isValidRelease } from "@/lib/androidUpdate";

const COPY_RESET_MS = 2500;

export default function AndroidDownloadSection() {
  const [release, setRelease] = useState(null);
  const [copyState, setCopyState] = useState("idle");
  const copyTimeoutRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/android-latest.json", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && isValidRelease(data)) setRelease(data);
      } catch {
        // No pointer yet (or offline): the section stays hidden rather than
        // offering a link that leads nowhere.
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  if (!release) return null;

  const copyLink = async () => {
    try {
      // navigator.clipboard is absent outside secure contexts, which throws
      // here rather than failing the write quietly.
      await navigator.clipboard.writeText(release.apkUrl);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    copyTimeoutRef.current = setTimeout(() => setCopyState("idle"), COPY_RESET_MS);
  };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
      <div className="px-5 py-3 border-b border-neutral-200 bg-neutral-50/60 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Android app</p>
        <MonitorSmartphone size={14} className="text-neutral-400" aria-hidden="true" />
      </div>
      <div className="px-5 py-4">
        <p className="text-sm font-semibold tracking-tight text-neutral-900">
          Install Luumbo on an Android phone
        </p>
        <p className="mt-1 text-xs font-medium leading-relaxed text-neutral-500">
          Version {release.versionName}. The link opens GitHub on the phone to
          fetch the installer; tap the file to install. Android asks you to
          allow installs from this app the first time, because Luumbo is not on
          the Play Store.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a
            href={release.apkUrl}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-accent/90"
          >
            <Download size={13} aria-hidden="true" />
            Download APK
          </a>
          <button
            onClick={copyLink}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            {copyState === "copied" ? (
              <Check size={13} aria-hidden="true" />
            ) : (
              <Link2 size={13} aria-hidden="true" />
            )}
            {copyState === "copied" ? "Link copied" : "Copy link"}
          </button>
        </div>

        <p role="status" className="mt-2 text-xs font-medium text-neutral-500">
          {copyState === "failed" && (
            <span className="text-red-600">
              Could not reach the clipboard. Open the{" "}
              <a
                href={release.releaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-accent hover:underline"
              >
                release page
              </a>{" "}
              and copy its address instead.
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
