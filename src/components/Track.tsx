"use client";

import { useEffect } from "react";

let last = { key: "", at: 0 };

/** Records one page view in the owner's private usage log. Sends nothing personal. */
export function Track({ type, domain, mode }: { type: "home" | "view"; domain?: string; mode?: string }) {
  useEffect(() => {
    const body = JSON.stringify({ type, domain, mode });
    // Don't double-count the same page within a few seconds (re-renders, dev mode).
    if (last.key === body && Date.now() - last.at < 5000) return;
    last = { key: body, at: Date.now() };
    try {
      if (!navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" })))
        fetch("/api/track", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
    } catch {}
  }, [type, domain, mode]);
  return null;
}
