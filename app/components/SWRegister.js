"use client";

import { useEffect } from "react";

const CURRENT_CACHES = ["lumbo-app-v5", "lumbo-audio-cache-v1"];
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

const activateWaiting = (reg) => {
  reg.waiting?.postMessage("SKIP_WAITING");
};

export default function SWRegister() {
  useEffect(() => {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") return;

    // Clear old caches instantly on the client side
    if ("caches" in window) {
      caches.keys().then((keys) => {
        keys.forEach((key) => {
          if (!CURRENT_CACHES.includes(key)) {
            caches.delete(key);
          }
        });
      });
    }

    if (!("serviceWorker" in navigator)) return;

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
