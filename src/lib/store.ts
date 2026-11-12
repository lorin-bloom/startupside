import "server-only";
import { config } from "./config";

/**
 * Tiny key-value store. Uses Upstash Redis (REST) when configured — which
 * makes caching, rate limits and the spending cap global across serverless
 * instances — and falls back to process memory for local development.
 */

type Entry = { value: string; expiresAt: number };
const mem = new Map<string, Entry>();

function memGet(key: string): string | null {
  const e = mem.get(key);
  if (!e) return null;
  if (e.expiresAt && e.expiresAt < Date.now()) {
    mem.delete(key);
    return null;
  }
  return e.value;
}

async function redis(command: (string | number)[]): Promise<unknown> {
  const res = await fetch(config.redisUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.redisToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Store error ${res.status}`);
  const data = (await res.json()) as { result?: unknown; error?: string };
  if (data.error) throw new Error(data.error);
  return data.result;
}

const hasRedis = () => Boolean(config.redisUrl && config.redisToken);

export const store = {
  isShared: hasRedis,

  async get(key: string): Promise<string | null> {
    if (hasRedis()) return ((await redis(["GET", key])) as string | null) ?? null;
    return memGet(key);
  },

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (hasRedis()) {
      await redis(["SET", key, value, "EX", Math.max(1, Math.round(ttlSeconds))]);
      return;
    }
    mem.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  },

  /** Atomically increments a numeric value and returns the new total. */
  async incrBy(key: string, amount: number, ttlSeconds: number): Promise<number> {
    if (hasRedis()) {
      const total = Number(await redis(["INCRBYFLOAT", key, amount]));
      if (Math.abs(total - amount) < 1e-9) await redis(["EXPIRE", key, ttlSeconds]);
      return total;
    }
    const current = Number(memGet(key) ?? 0);
    const total = current + amount;
    const existing = mem.get(key);
    mem.set(key, { value: String(total), expiresAt: existing?.expiresAt || Date.now() + ttlSeconds * 1000 });
    return total;
  },

  /** Adds to the front of a list, keeping only the newest `max` items. */
  async push(key: string, value: string, max: number): Promise<void> {
    if (hasRedis()) {
      await redis(["LPUSH", key, value]);
      await redis(["LTRIM", key, 0, max - 1]);
      return;
    }
    const list = memLists.get(key) ?? [];
    list.unshift(value);
    memLists.set(key, list.slice(0, max));
  },

  /** The newest `count` items of a list. */
  async range(key: string, count: number): Promise<string[]> {
    if (hasRedis()) return ((await redis(["LRANGE", key, 0, count - 1])) as string[] | null) ?? [];
    return (memLists.get(key) ?? []).slice(0, count);
  },
};

const memLists = new Map<string, string[]>();
