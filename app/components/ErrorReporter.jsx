"use client";

import { useEffect } from "react";

const MAX_REPORTS_PER_PAGE = 3;

export default function ErrorReporter() {
  useEffect(() => {
    let sent = 0;

    const report = (message, stack) => {
      if (sent >= MAX_REPORTS_PER_PAGE) return;
      sent += 1;
      const body = JSON.stringify({
        message: String(message || "Unknown error").slice(0, 500),
        stack: String(stack || "").slice(0, 2000),
        path: window.location.pathname + window.location.search,
      });
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(
            "/api/log-error",
            new Blob([body], { type: "application/json" })
          );
          return;
        }
      } catch {
        // fall through to fetch
      }
      fetch("/api/log-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    };

    const onError = (event) => {
      report(event.message, event.error?.stack);
    };
    const onRejection = (event) => {
      const reason = event.reason;
      report(reason?.message || reason || "Unhandled rejection", reason?.stack);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
