"use client";

import { useEffect } from "react";

export default function SWRegister() {
  useEffect(() => {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") return;

    // Clear old caches instantly on the client side
    if ("caches" in window) {
      caches.keys().then((keys) => {
        keys.forEach((key) => {
          if (key !== "earlymusic-app-v4" && key !== "earlymusic-audio-cache-v1") {
            caches.delete(key);
          }
        });
      });
    }

    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker.register("/sw.js").then((reg) => {
      if (reg.waiting) {
        reg.waiting.postMessage("SKIP_WAITING");
      }

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            newWorker.postMessage("SKIP_WAITING");
          }
        });
      });
    });
  }, []);

  return null;
}
