"use client";

import { useEffect } from "react";

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

const activateWaiting = (reg) => {
  reg.waiting?.postMessage("SKIP_WAITING");
};

export default function SWRegister() {
  useEffect(() => {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") return;

    if (!("serviceWorker" in navigator)) return;

    // Retiring old caches is the worker's job alone — its activate handler
    // already deletes every name it does not recognise. Copying that here meant
    // hand-maintaining a second list of cache names: bump the version in sw.js,
    // forget this one, and each mount deleted the new worker's caches including
    // the offline downloads, while the download list in localStorage survived.

    let refreshing = false;
    let regRef = null;
    let intervalId = null;

    // Once the new worker takes control, reload once into the new version.
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const checkForUpdates = () => {
      if (regRef) regRef.update().catch(() => {});
    };
    const checkOnVisible = () => {
      if (document.visibilityState === "visible") checkForUpdates();
    };
    document.addEventListener("visibilitychange", checkOnVisible);

    navigator.serviceWorker.register("/sw.js").then((reg) => {
      regRef = reg;

      // An update finished downloading while the app was closed — activate now.
      if (reg.waiting && navigator.serviceWorker.controller) {
        activateWaiting(reg);
      }

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          // New version downloaded — activate immediately (auto-update).
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            activateWaiting(reg);
          }
        });
      });

      // Discover updates during long-lived sessions.
      intervalId = setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS);
    });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", checkOnVisible);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return null;
}
