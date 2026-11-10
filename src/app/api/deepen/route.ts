import { apiErrorMessage } from "@/lib/claude";
import { config, liveStatus } from "@/lib/config";
import { normalizeDomain } from "@/lib/domain";
import { checkRateLimit, clientIp, reserveSpend } from "@/lib/limits";
import { deepenReport } from "@/lib/pipeline";
import { DEEP_DIVES, type DeepSection } from "@/lib/prompts";
import { getCachedReport, saveReport } from "@/lib/report-cache";
import { Report } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 180;

/**
 * POST { domain, section, report? } → { report }
 * Runs deeper research on one section of a live report, only when a reader asks.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { domain?: string; section?: string; report?: unknown };
  const domain = normalizeDomain(String(body.domain ?? ""));
  const section = String(body.section ?? "") as DeepSection;
  if (!domain || !(section in DEEP_DIVES)) return Response.json({ error: "Unknown company or section." }, { status: 400 });

  const status = liveStatus();
  if (!status.ok) return Response.json({ error: `${status.reason} Deeper research needs live research.` }, { status: 503 });

  // Prefer the server's copy. A copy sent by the browser is used only for this
  // reader and never written back to the shared cache, so it can't be poisoned.
  let base = await getCachedReport(domain);
  const fromServer = Boolean(base);
  if (!base && body.report && JSON.stringify(body.report).length < 500_000) base = Report.parse(body.report);
  if (!base || base.mode !== "live" || base.company.domain !== domain)
    return Response.json({ error: "Run the report again before researching deeper." }, { status: 404 });
  if (base.deepened.includes(section)) return Response.json({ report: base });

  const rl = await checkRateLimit("deepen", clientIp(req), config.deepenPerIpPerHour);
  if (!rl.ok) return Response.json({ error: `Limit reached. Try again in about ${rl.resetMinutes} minutes.` }, { status: 429 });
  const settle = await reserveSpend(config.deepenReserveUsd);
  if (!settle) return Response.json({ error: "Today's research budget for this demo has been used up." }, { status: 429 });

  let cost = config.deepenReserveUsd;
  try {
    const { report, costUsd } = await deepenReport(base, section);
    cost = costUsd;
    if (fromServer) await saveReport(report);
    return Response.json({ report });
  } catch (err) {
    return Response.json({ error: apiErrorMessage(err) }, { status: 502 });
  } finally {
    await settle(cost);
  }
}
