import { apiErrorMessage, runAgent } from "@/lib/claude";
import { config, isHaiku, liveStatus } from "@/lib/config";
import { normalizeDomain } from "@/lib/domain";
import { checkRateLimit, clientIp, reserveSpend } from "@/lib/limits";
import { ASK_SYSTEM } from "@/lib/prompts";
import { Report } from "@/lib/schema";
import { getSample } from "@/data/samples";
import { getCachedReport } from "@/lib/report-cache";

export const runtime = "nodejs";
export const maxDuration = 120;

type Turn = { role: "user" | "assistant"; text: string };

/** POST { domain, question, history?, report? } → { answer, webSources } */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    domain?: string;
    question?: string;
    history?: Turn[];
    report?: unknown;
  };
  const domain = normalizeDomain(String(body.domain ?? ""));
  const question = String(body.question ?? "").trim().slice(0, 600);
  if (!domain || question.length < 3) return Response.json({ error: "Please enter a question." }, { status: 400 });

  const status = liveStatus();
  if (!status.ok) return Response.json({ error: `${status.reason} Follow-up questions need live research.` }, { status: 503 });

  const rl = await checkRateLimit("ask", clientIp(req), config.askPerIpPerHour);
  if (!rl.ok) return Response.json({ error: `Question limit reached. Try again in about ${rl.resetMinutes} minutes.` }, { status: 429 });

  // Prefer server-held research; fall back to the copy the browser is showing (size-capped).
  let report: Report | null = getSample(domain);
  if (!report) {
    report = await getCachedReport(domain);
  }
  if (!report && body.report && JSON.stringify(body.report).length < 400_000) report = Report.parse(body.report);
  if (!report) return Response.json({ error: "Research for this company has expired. Re-run the report first." }, { status: 404 });

  const settle = await reserveSpend(config.askReserveUsd);
  if (!settle) return Response.json({ error: "Today's research budget for this demo has been used up." }, { status: 429 });

  const history = (Array.isArray(body.history) ? body.history : [])
    .slice(-6)
    .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${String(t.text).slice(0, 2000)}`)
    .join("\n\n");

  const { hiring, ...rest } = report;
  const context = { ...rest, hiring: { ...hiring, roles: hiring.roles.slice(0, 40) } };

  let cost = config.askReserveUsd;
  try {
    const run = await runAgent({
      system: ASK_SYSTEM,
      prompt: `Research report on ${report.company.name || domain} (JSON):\n${JSON.stringify(context)}\n\n${
        history ? `Conversation so far:\n${history}\n\n` : ""
      }Question: ${question}`,
      maxSearches: isHaiku(config.models.research) ? 3 : 4,
      maxFetches: isHaiku(config.models.research) ? 1 : 2,
      maxTokens: 6000,
      effort: "low",
    });
    cost = run.costUsd;
    const webSources = [...new Map(run.citations.map((c) => [c.url, c])).values()].slice(0, 8);
    return Response.json({ answer: run.text.trim(), webSources });
  } catch (err) {
    return Response.json({ error: apiErrorMessage(err) }, { status: 502 });
  } finally {
    await settle(cost);
  }
}
