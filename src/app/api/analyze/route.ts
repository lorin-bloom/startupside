import { config, liveStatus } from "@/lib/config";
import { normalizeDomain } from "@/lib/domain";
import { checkRateLimit, clientIp, reserveSpend } from "@/lib/limits";
import { buildReport } from "@/lib/pipeline";
import { getSample } from "@/data/samples";
import { Report } from "@/lib/schema";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 300;

const cacheKey = (domain: string) => `report:v1:${domain}`;
const inflight = new Map<string, Promise<Report>>();

type Event =
  | { type: "progress"; step: string; state: string; message?: string }
  | { type: "result"; report: Report; cached: boolean }
  | { type: "error"; code: string; message: string };

/**
 * POST { website, refresh? } → newline-delimited JSON stream of progress
 * events, ending in one `result` or `error` event.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { website?: string; refresh?: boolean };
  const domain = normalizeDomain(String(body.website ?? ""));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: Event) => {
        // The browser may have navigated away; keep the research running for the cache.
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {}
      };
      const fail = (code: string, message: string) => {
        send({ type: "error", code, message });
        try {
          controller.close();
        } catch {}
      };

      if (!domain) return fail("invalid_url", "That doesn't look like a public company website. Try something like linear.app.");

      const sample = getSample(domain);
      if (sample) {
        send({ type: "result", report: sample, cached: true });
        return controller.close();
      }

      try {
        if (!body.refresh) {
          const hit = await store.get(cacheKey(domain));
          if (hit) {
            send({ type: "result", report: Report.parse(JSON.parse(hit)), cached: true });
            return controller.close();
          }
        }

        const status = liveStatus();
        if (!status.ok) return fail("live_disabled", `${status.reason} You can still explore the sample reports.`);

        let job = inflight.get(domain);
        if (!job) {
          const rl = await checkRateLimit("analyze", clientIp(req), config.analyzePerIpPerHour);
          if (!rl.ok)
            return fail("rate_limited", `You've reached the limit of ${config.analyzePerIpPerHour} new reports per hour. Try again in about ${rl.resetMinutes} minutes.`);

          const settle = await reserveSpend(config.reportReserveUsd);
          if (!settle)
            return fail("budget", "Today's research budget for this demo has been used up. New reports will be available tomorrow — sample reports still work.");

          job = (async () => {
            let cost = config.reportReserveUsd;
            try {
              const { report, costUsd } = await buildReport(domain, (step, state, message) =>
                send({ type: "progress", step, state, message }),
              );
              cost = costUsd;
              await store.set(cacheKey(domain), JSON.stringify(report), config.reportCacheDays * 86400);
              return report;
            } finally {
              await settle(cost);
            }
          })();
          inflight.set(domain, job);
          job.finally(() => inflight.delete(domain)).catch(() => {});
        } else {
          send({ type: "progress", step: "site", state: "active", message: "Joining a report already in progress" });
        }

        const report = await job;
        send({ type: "result", report, cached: false });
        try {
          controller.close();
        } catch {}
      } catch (err) {
        console.error("analyze failed", domain, err);
        fail("failed", err instanceof Error ? err.message : "Research failed. Please try again.");
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
