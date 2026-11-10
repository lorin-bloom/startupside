import "server-only";

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

type Price = { input: number; output: number; cacheRead: number; cacheWrite: number };

/**
 * USD per million tokens. Used for the spending cap, not for billing.
 * Haiku 5.5 has a second, higher rate card for prompts over 100K tokens.
 */
const PRICING: Record<string, { base: Price; long?: Price }> = {
  "claude-opus-5-5": { base: { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 } },
  "claude-sonnet-5-5": { base: { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 } },
  "claude-haiku-5-5": {
    base: { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
    long: { input: 0.5, output: 2.5, cacheRead: 0.05, cacheWrite: 0.625 },
  },
};

const model = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
/** Haiku is far cheaper but uses the older web tools and has no refusal fallback. */
const isHaiku = model.includes("haiku");

export const config = {
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
  model,
  isHaiku,
  liveEnabled: process.env.LIVE_RESEARCH_ENABLED !== "false",
  /** Global spending cap per UTC day, across all visitors. */
  dailySpendCapUsd: num("DAILY_SPEND_CAP_USD", 2),
  /** Spend reserved before a report starts, so parallel requests can't overshoot the cap. */
  reportReserveUsd: num("REPORT_RESERVE_USD", isHaiku ? 0.5 : 3),
  /** Spend reserved for one follow-up question. */
  askReserveUsd: isHaiku ? 0.1 : 0.6,
  analyzePerIpPerHour: num("ANALYZE_LIMIT_PER_HOUR", 3),
  askPerIpPerHour: num("ASK_LIMIT_PER_HOUR", 20),
  reportCacheDays: num("REPORT_CACHE_DAYS", 7),
  webSearchUsdPerSearch: 0.01,
  redisUrl: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "",
  redisToken: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "",
};

/** Rates for one request, given its total prompt size in tokens. */
export function pricing(promptTokens = 0): Price {
  const p = PRICING[config.model] ?? PRICING["claude-opus-5-5"];
  return p.long && promptTokens > 100_000 ? p.long : p.base;
}

export function liveStatus(): { ok: true } | { ok: false; reason: string } {
  if (!config.liveEnabled) return { ok: false, reason: "Live research is switched off on this deployment." };
  if (!config.apiKey) return { ok: false, reason: "Live research isn't configured yet (no API key on the server)." };
  return { ok: true };
}
