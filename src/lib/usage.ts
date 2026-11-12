import "server-only";
import { createHash } from "node:crypto";
import { clientIp } from "./limits";
import { store } from "./store";

/**
 * A private activity log for the site owner, read with `node scripts/usage.mjs`.
 * It records what people look at and research, never IP addresses: each
 * visitor gets a short anonymous id (a hash salted with a server secret), and
 * location comes from Vercel's country/city headers.
 */

export type UsageType = "home" | "view" | "new report" | "cached report" | "deep dive" | "question";

const LOG_KEY = "usage:v1";
const MAX_EVENTS = 5000;

function visitorId(req: Request): string {
  const salt = process.env.ANTHROPIC_API_KEY || "startupside";
  return createHash("sha256").update(`${salt}:${clientIp(req)}`).digest("hex").slice(0, 8);
}

function place(req: Request): string {
  const city = req.headers.get("x-vercel-ip-city");
  const country = req.headers.get("x-vercel-ip-country");
  return [city ? decodeURIComponent(city) : "", country].filter(Boolean).join(", ");
}

/** Records one event. Never throws: logging must not break the app. */
export async function logUsage(req: Request, type: UsageType, domain = "", detail = ""): Promise<void> {
  try {
    const event = {
      t: new Date().toISOString(),
      type,
      domain: domain.slice(0, 100),
      detail: detail.slice(0, 160),
      visitor: visitorId(req),
      place: place(req),
    };
    await store.push(LOG_KEY, JSON.stringify(event), MAX_EVENTS);
  } catch (err) {
    console.error("usage log failed", err);
  }
}
