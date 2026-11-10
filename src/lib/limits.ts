import "server-only";
import { config } from "./config";
import { store } from "./store";

const today = () => new Date().toISOString().slice(0, 10);
const spendKey = () => `spend:${today()}`;

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] || req.headers.get("x-real-ip") || "local").trim().slice(0, 64);
}

/** Fixed-window limiter: `limit` requests per hour per IP for a given action. */
export async function checkRateLimit(action: string, ip: string, limit: number) {
  const hour = Math.floor(Date.now() / 3_600_000);
  const count = await store.incrBy(`rl:${action}:${ip}:${hour}`, 1, 3700);
  const resetMinutes = 60 - new Date().getUTCMinutes();
  return { ok: count <= limit, resetMinutes };
}

export async function spentToday(): Promise<number> {
  return Number((await store.get(spendKey())) ?? 0);
}

/**
 * Reserves spend against the global daily cap before any paid call is made.
 * Returns a function that settles the reservation with the actual cost.
 */
export async function reserveSpend(estimateUsd: number) {
  const total = await store.incrBy(spendKey(), estimateUsd, 2 * 86400);
  if (total > config.dailySpendCapUsd) {
    await store.incrBy(spendKey(), -estimateUsd, 2 * 86400);
    return null;
  }
  let settled = false;
  return async (actualUsd: number) => {
    if (settled) return;
    settled = true;
    await store.incrBy(spendKey(), actualUsd - estimateUsd, 2 * 86400);
  };
}
