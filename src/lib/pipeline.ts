import "server-only";
import { config } from "./config";
import { extractJson, normalizeUrl, runAgent, apiErrorMessage } from "./claude";
import { findJobBoard, type JobBoard } from "./jobs";
import { capitalPrompt, marketPrompt, peoplePrompt, RESEARCH_SYSTEM, synthesisPrompt, type SiteContext } from "./prompts";
import { Report, type Source } from "./schema";
import { readSite } from "./site";

export type StepId = "site" | "jobs" | "people" | "capital" | "market" | "synthesis";
export type Emit = (step: StepId, state: "active" | "done" | "warn", message?: string) => void;

type Json = Record<string, unknown>;
type AgentOutput = { data: Json; sources: Source[]; note?: string };

/**
 * Re-keys an agent's sources with a prefix (so three parallel agents can't
 * collide), drops any source whose URL never appeared in real retrieval, and
 * downgrades "verified" claims that are left without evidence.
 */
function reconcileSources(raw: Json, prefix: string, allowed: Set<string> | null): AgentOutput {
  const list = Array.isArray(raw.sourceList) ? (raw.sourceList as Json[]) : [];
  const idMap = new Map<string, string>();
  const sources: Source[] = [];
  let dropped = 0;
  for (const s of list) {
    const url = typeof s.url === "string" ? s.url : "";
    const id = String(s.id ?? "");
    if (!url.startsWith("http")) continue;
    const norm = normalizeUrl(url);
    if (allowed && !allowed.has(norm) && !allowed.has(norm.split("?")[0])) {
      dropped++;
      continue;
    }
    const newId = `${prefix}${sources.length + 1}`;
    idMap.set(id, newId);
    sources.push({
      id: newId,
      title: String(s.title ?? url).slice(0, 200),
      url,
      publisher: String(s.publisher ?? ""),
      date: String(s.date ?? ""),
    });
  }

  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;
    const obj: Json = {};
    for (const [k, v] of Object.entries(node as Json)) obj[k] = k === "sourceList" ? undefined : walk(v);
    if (Array.isArray(obj.sources)) {
      const mapped = (obj.sources as unknown[]).map((id) => idMap.get(String(id))).filter(Boolean) as string[];
      obj.sources = [...new Set(mapped)];
      if (mapped.length === 0) {
        if (obj.status === "verified") obj.status = "inferred";
        if (obj.exact === true) obj.exact = false;
        if (obj.rationaleExact === true) obj.rationaleExact = false;
      }
    }
    return obj;
  };

  const data = walk(raw) as Json;
  const note = dropped ? `${dropped} citation${dropped > 1 ? "s" : ""} removed because the link couldn't be matched to a retrieved page.` : undefined;
  return { data, sources, note };
}

async function agent(
  step: StepId,
  prefix: string,
  prompt: string,
  base: Set<string>,
  emit: Emit,
  limits: { maxSearches: number; maxFetches: number },
): Promise<{ out: AgentOutput | null; cost: number; retrieved: Set<string> }> {
  emit(step, "active");
  try {
    const run = await runAgent({ system: RESEARCH_SYSTEM, prompt, ...limits });
    const retrieved = new Set([...base, ...run.retrievedUrls, ...run.citations.map((c) => normalizeUrl(c.url))]);
    const allowed = run.retrievedUrls.size > 0 ? retrieved : null;
    const out = reconcileSources(extractJson(run.text) as Json, prefix, allowed);
    if (!allowed) out.note = "Some links could not be automatically cross-checked against retrieved pages.";
    emit(step, "done");
    return { out, cost: run.costUsd, retrieved };
  } catch (err) {
    emit(step, "warn", apiErrorMessage(err));
    return { out: null, cost: 0, retrieved: base };
  }
}

function jobsSummary(board: JobBoard | null): string {
  if (!board) return "Open roles: no public job board (Ashby/Greenhouse/Lever) was found.";
  const byDept = new Map<string, number>();
  for (const r of board.roles) byDept.set(r.department, (byDept.get(r.department) ?? 0) + 1);
  const lines = board.roles.slice(0, 60).map((r) => `- ${r.title} | ${r.department} | ${r.location}`);
  return `Open roles (exact, from the public ${board.provider} job board ${board.boardUrl}): ${board.roles.length} total.
By department: ${[...byDept].map(([d, n]) => `${d}: ${n}`).join(", ")}
${lines.join("\n")}`;
}

export async function buildReport(domain: string, emit: Emit): Promise<{ report: Report; costUsd: number }> {
  const today = new Date().toISOString().slice(0, 10);

  emit("site", "active");
  const site = await readSite(domain).catch((err: unknown) => {
    throw new Error(`We couldn't read https://${domain} (${err instanceof Error ? err.message : "unreachable"}). Check the address and try again.`);
  });
  emit("site", "done");

  emit("jobs", "active");
  const board = await findJobBoard(domain, site.links).catch(() => null);
  emit("jobs", board ? "done" : "warn", board ? `${board.roles.length} open roles on ${board.provider}` : "No public job board found");

  const ctx: SiteContext = { domain, url: site.url, title: site.title, description: site.description, text: site.text, careersUrl: site.careersUrl, today };
  const base = new Set([site.url, site.careersUrl, board?.boardUrl ?? "", `https://${domain}`].filter(Boolean).map(normalizeUrl));

  // Haiku reads raw search results (no dynamic filtering), so fewer searches keep
  // each prompt under 100K tokens, where its cheaper rate card applies.
  const n = (opus: number, haiku: number) => (config.isHaiku ? haiku : opus);
  const [people, capital, market] = await Promise.all([
    agent("people", "p", peoplePrompt(ctx), base, emit, { maxSearches: n(8, 5), maxFetches: n(4, 2) }),
    agent("capital", "c", capitalPrompt(ctx), base, emit, { maxSearches: n(8, 5), maxFetches: n(4, 2) }),
    agent("market", "m", marketPrompt(ctx, jobsSummary(board)), base, emit, { maxSearches: n(6, 4), maxFetches: board ? 1 : n(4, 2) }),
  ]);
  if (!people.out && !capital.out && !market.out) throw new Error("Research failed for every section. Please try again later.");

  const homepageSource: Source = { id: "w1", title: site.title || domain, url: site.url, publisher: domain, date: "" };
  const boardSource: Source | null = board
    ? { id: "w2", title: `${board.provider} job board`, url: board.boardUrl, publisher: board.provider, date: today }
    : null;

  const p = people.out?.data ?? {};
  const c = capital.out?.data ?? {};
  const m = market.out?.data ?? {};
  const pCompany = (p.company ?? {}) as Json;
  const mHiring = (m.hiring ?? {}) as Json;
  const modelRoles = Array.isArray(mHiring.roles) ? mHiring.roles : [];

  const sources = [homepageSource, ...(boardSource ? [boardSource] : []), ...(people.out?.sources ?? []), ...(capital.out?.sources ?? []), ...(market.out?.sources ?? [])];

  const draft = {
    version: 1,
    mode: "live",
    researchedAt: new Date().toISOString(),
    company: {
      ...pCompany,
      name: (pCompany.name as string) || site.siteName || site.title.split(/[|–—-]/)[0].trim() || domain,
      website: site.url,
      domain,
      logoUrl: site.logoUrl,
      sources: [...((pCompany.sources as string[]) ?? []), "w1"],
    },
    founders: p.founders ?? {},
    team: p.team ?? {},
    funding: c.funding ?? {},
    financials: c.financials ?? {},
    news: c.news ?? [],
    business: m.business ?? {},
    hiring: board
      ? {
          checkedAt: today,
          sourceLabel: `${board.provider} public job board${board.matchedBy === "name" ? " (matched by company name — verify it's the right company)" : ""}`,
          sourceUrl: board.boardUrl,
          method: "job-board-api",
          totalOpenings: board.roles.length,
          note: "",
          roles: board.roles,
          interpretation: mHiring.interpretation ?? [],
        }
      : {
          checkedAt: today,
          sourceLabel: site.careersUrl ? "Company careers page" : "No careers page found",
          sourceUrl: site.careersUrl,
          method: modelRoles.length ? "careers-page" : "none",
          totalOpenings: modelRoles.length ? modelRoles.length : null,
          note: (mHiring.note as string) || "",
          roles: modelRoles,
          interpretation: mHiring.interpretation ?? [],
        },
    sources,
    notes: [people, capital, market].map((r) => r.out?.note).filter(Boolean),
  };

  // Executive layer: written only from the research above, no web access.
  emit("synthesis", "active");
  let synthCost = 0;
  let synth: Json = {};
  try {
    const compact = { ...draft, hiring: { ...draft.hiring, roles: undefined, rolesByDepartment: countBy(draft.hiring.roles as { department: string }[]) } };
    const run = await runAgent({ system: RESEARCH_SYSTEM, prompt: synthesisPrompt(JSON.stringify(compact)), maxTokens: 12000 });
    synthCost = run.costUsd;
    synth = extractJson(run.text) as Json;
    const validIds = new Set(sources.map((s) => s.id));
    synth = JSON.parse(JSON.stringify(synth), (k, v) => (k === "sources" && Array.isArray(v) ? v.filter((id) => validIds.has(id)) : v));
    emit("synthesis", "done");
  } catch (err) {
    emit("synthesis", "warn", apiErrorMessage(err));
  }

  const report = Report.parse({
    ...draft,
    snapshot: synth.snapshot ?? {},
    investorCase: synth.investorCase ?? {},
    notes: [...draft.notes, ...(Array.isArray(synth.notes) ? synth.notes : [])],
  });

  // Safety net: keep short display fields short even if the model over-explains.
  const co = report.company;
  co.name = clip(co.name, 40) || site.siteName || domain;
  co.stage = clip(co.stage, 28);
  co.founded = clip(co.founded, 24);
  co.headquarters = clip(co.headquarters, 48);
  co.industry = clip(co.industry, 56);
  co.tagline = clip(co.tagline, 120);
  for (const f of report.founders.people) f.title = clip(f.title, 40);
  report.team.headcountEstimates = report.team.headcountEstimates.slice(0, 6);
  report.notes = report.notes.slice(0, 4);

  // LinkedIn URLs must come from real retrieval, never from a guess.
  const seen = new Set([...people.retrieved, ...capital.retrieved]);
  if (site.linkedinUrl) report.company.linkedinUrl = site.linkedinUrl;
  else if (report.company.linkedinUrl && !seen.has(normalizeUrl(report.company.linkedinUrl))) report.company.linkedinUrl = "";
  for (const f of report.founders.people) if (f.linkedinUrl && !seen.has(normalizeUrl(f.linkedinUrl))) f.linkedinUrl = "";
  for (const i of report.funding.investors) if (i.linkedinUrl && !seen.has(normalizeUrl(i.linkedinUrl))) i.linkedinUrl = "";

  const costUsd = people.cost + capital.cost + market.cost + synthCost;
  console.log(`[report] ${domain}: $${costUsd.toFixed(3)} (${config.model})`);
  return { report, costUsd };
}

/** Cuts at the first aside ("(...", "; ...", " - ...", ". ...") and enforces a maximum length. */
function clip(text: string, max: number): string {
  let t = text.split(/\s\(|;\s|\s[—–]\s|\.\s/)[0].trim();
  if (t.length > max) t = `${t.slice(0, max - 1).replace(/[\s,]+\S*$/, "")}…`;
  return t;
}

function countBy(roles: { department: string }[]) {
  const map: Record<string, number> = {};
  for (const r of roles ?? []) map[r.department] = (map[r.department] ?? 0) + 1;
  return map;
}
