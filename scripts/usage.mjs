// Prints the site's private activity log from Upstash Redis.
// Usage: node scripts/usage.mjs [days]        (default: last 30 days)
//        node scripts/usage.mjs [days] --json (raw events)
// Needs KV_REST_API_URL and KV_REST_API_READ_ONLY_TOKEN (or KV_REST_API_TOKEN) in .env.local.
import { readFileSync } from "node:fs";

const env = {};
try {
  for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m) env[m[1]] = m[2];
  }
} catch {}
const url = process.env.KV_REST_API_URL || env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
const token =
  process.env.KV_REST_API_READ_ONLY_TOKEN || env.KV_REST_API_READ_ONLY_TOKEN || env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) {
  console.error("Missing KV_REST_API_URL / KV_REST_API_READ_ONLY_TOKEN in .env.local.");
  process.exit(1);
}

const days = Number(process.argv[2]) || 30;
const res = await fetch(url, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(["LRANGE", "usage:v1", 0, 4999]),
});
const { result, error } = await res.json();
if (error) {
  console.error("Upstash error:", error);
  process.exit(1);
}
const since = Date.now() - days * 86_400_000;
const events = (result ?? []).map((r) => JSON.parse(r)).filter((e) => Date.parse(e.t) >= since);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(events, null, 1));
  process.exit(0);
}

const count = (xs) => [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map())].sort((a, b) => b[1] - a[1]);
const of = (type) => events.filter((e) => e.type === type);
console.log(`Last ${days} days: ${events.length} events from ${new Set(events.map((e) => e.visitor)).size} unique visitors`);
console.log(`Homepage visits: ${of("home").length} · report views: ${of("view").length} · new reports: ${of("new report").length} · cached reports: ${of("cached report").length} · deep dives: ${of("deep dive").length} · questions: ${of("question").length}`);
console.log("\nMost viewed companies:", count(of("view").map((e) => e.domain)).slice(0, 15).map(([d, n]) => `${d} (${n})`).join(", ") || "none");
console.log("Companies researched:", count([...of("new report"), ...of("cached report")].map((e) => e.domain)).slice(0, 25).map(([d, n]) => `${d} (${n})`).join(", ") || "none");
console.log("Visitor locations:", count(events.map((e) => e.place || "unknown")).slice(0, 15).map(([p, n]) => `${p} (${n})`).join(", "));
console.log("\nRecent activity (newest first):");
for (const e of events.slice(0, 60)) console.log(`${e.t.slice(0, 16).replace("T", " ")}  ${e.type.padEnd(13)} ${e.domain.padEnd(24)} ${e.detail.padEnd(30).slice(0, 30)} ${e.place}  #${e.visitor}`);
