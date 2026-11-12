import { normalizeDomain } from "@/lib/domain";
import { checkRateLimit, clientIp } from "@/lib/limits";
import { logUsage } from "@/lib/usage";

export const runtime = "nodejs";

/** POST { type: "home" | "view", domain?, mode? } — page views for the owner's /admin log. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { type?: string; domain?: string; mode?: string };
  const type = body.type === "home" ? "home" : body.type === "view" ? "view" : null;
  if (!type) return new Response(null, { status: 204 });

  const rl = await checkRateLimit("track", clientIp(req), 120);
  if (!rl.ok) return new Response(null, { status: 204 });

  const domain = body.domain ? (normalizeDomain(body.domain) ?? "") : "";
  await logUsage(req, type, domain, body.mode === "sample" ? "sample report" : body.mode === "live" ? "live report" : "");
  return new Response(null, { status: 204 });
}
