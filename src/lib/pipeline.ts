import "server-only";
import { config, isHaiku } from "./config";
import { extractJson, normalizeUrl, runAgent, apiErrorMessage } from "./claude";
import { findJobBoard, type JobBoard } from "./jobs";
import { corePrompt, deepPrompt, RESEARCH_SYSTEM, synthesisPrompt, type DeepSection, type SiteContext } from "./prompts";
import { Report, type Source } from "./schema";
import { readSite } from "./site";

export type StepId = "site" | "jobs" | "core" | "synthesis";
export type Emit = (step: StepId, state: "active" | "done" | "warn", message?: string) => void;

type Json = Record<string, unknown>;
type AgentOutput = { data: Json; sources: Source[]; note?: string };

/** Search budgets. Haiku reads raw search results (no dynamic filtering), so it gets
 * fewer searches to keep each prompt under 100K tokens, where its cheaper rate applies. */
const haikuResearch = isHaiku(config.models.research);
const budget = (strong: number, haiku: number) => (haikuResearch ? haiku : strong);

/**
 * Re-keys an agent's sources with a prefix (so separate research runs can't
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

/** Runs one web-research agent on the research model and cross-checks its citations. */
async function research(prompt: string, prefix: string, base: Set<string>, limits: { maxSearches: number; maxFetches: number }) {
  const run = await runAgent({ system: RESEARCH_SYSTEM, prompt, role: "research", ...limits });
  const retrieved = new Set([...base, ...run.retrievedUrls, ...run.citations.map((c) => normalizeUrl(c.url))]);
  const allowed = run.retrievedUrls.size > 0 ? retrieved : null;
  const out = reconcileSources(extractJson(run.text) as Json, prefix, allowed);
  if (!allowed) out.note = "Some links could not be automatically cross-checked against retrieved pages.";
  return { out, cost: run.costUsd, retrieved };
}

function jobsSummary(board: JobBoard | null): string {
  if (!board) return "Open roles: no public job board (Ashby/Greenhouse/Lever) was found.";
  const byDept = new Map<string, number>();
  for (const r of board.roles) byDept.set(r.department, (byDept.get(r.department) ?? 0) + 1);
  return `Open roles (exact, from the public ${board.provider} job board ${board.boardUrl}): ${board.roles.length} total.
By department: ${[...byDept].map(([d, n]) => `${d}: ${n}`).join(", ")}`;
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

  // One research pass for the essentials of every section (cheap model).
  const ctx: SiteContext = { domain, url: site.url, title: site.title, description: site.description, text: site.text, careersUrl: site.careersUrl, today };
  const base = new Set([site.url, site.careersUrl, board?.boardUrl ?? "", `https://${domain}`].filter(Boolean).map(normalizeUrl));
  emit("core", "active");
  let core: Awaited<ReturnType<typeof research>>;
  try {
    core = await research(corePrompt(ctx, jobsSummary(board)), "c", base, { maxSearches: budget(8, 6), maxFetches: board ? 1 : budget(3, 2) });
    emit("core", "done");
  } catch (err) {
    emit("core", "warn", apiErrorMessage(err));
    throw new Error(`Research failed: ${apiErrorMessage(err)} Please try again later.`);
  }

  const c = core.out.data;
  const cCompany = (c.company ?? {}) as Json;
  const cHiring = (c.hiring ?? {}) as Json;
  const modelRoles = Array.isArray(cHiring.roles) ? cHiring.roles : [];
  const sources: Source[] = [
    { id: "w1", title: site.title || domain, url: site.url, publisher: domain, date: "" },
    ...(board ? [{ id: "w2", title: `${board.provider} job board`, url: board.boardUrl, publisher: board.provider, date: today }] : []),
    ...core.out.sources,
  ];

  const draft = {
    version: 1,
    mode: "live",
    researchedAt: new Date().toISOString(),
    company: {
      ...cCompany,
      name: (cCompany.name as string) || site.siteName || site.title.split(/[|–—-]/)[0].trim() || domain,
      website: site.url,
      domain,
      logoUrl: site.logoUrl,
      sources: [...((cCompany.sources as string[]) ?? []), "w1"],
    },
    founders: c.founders ?? {},
    team: c.team ?? {},
    funding: c.funding ?? {},
    financials: c.financials ?? {},
    news: c.news ?? [],
    business: c.business ?? {},
    hiring: board
      ? {
          checkedAt: today,
          sourceLabel: `${board.provider} public job board${board.matchedBy === "name" ? " (matched by company name — verify it's the right company)" : ""}`,
          sourceUrl: board.boardUrl,
          method: "job-board-api",
          totalOpenings: board.roles.length,
          note: "",
          roles: board.roles,
          interpretation: cHiring.interpretation ?? [],
        }
      : {
          checkedAt: today,
          sourceLabel: site.careersUrl ? "Company careers page" : "No careers page found",
          sourceUrl: site.careersUrl,
          method: modelRoles.length ? "careers-page" : "none",
          totalOpenings: modelRoles.length ? modelRoles.length : null,
          note: (cHiring.note as string) || "",
          roles: modelRoles,
          interpretation: cHiring.interpretation ?? [],
        },
    sources,
    notes: [core.out.note].filter(Boolean),
    deepened: [],
  };

  // Executive layer (stronger model): written only from the research above, no web access.
  emit("synthesis", "active");
  let synthCost = 0;
  let synth: Json = {};
  try {
    const compact = { ...draft, hiring: { ...draft.hiring, roles: undefined, rolesByDepartment: countBy(draft.hiring.roles as { department: string }[]) } };
    const run = await runAgent({ system: RESEARCH_SYSTEM, prompt: synthesisPrompt(JSON.stringify(compact)), maxTokens: 12000, role: "analysis" });
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
  tidy(report, core.retrieved, site.siteName || domain);
  if (site.linkedinUrl) report.company.linkedinUrl = site.linkedinUrl;

  const costUsd = core.cost + synthCost;
  console.log(`[report] ${domain}: $${costUsd.toFixed(3)} (research ${config.models.research}, analysis ${config.models.analysis})`);
  return { report, costUsd };
}

/**
 * Deeper research on one section, run only when a reader asks for it. The new
 * findings replace that section's fields; everything else is kept as is.
 */
export async function deepenReport(base: Report, section: DeepSection): Promise<{ report: Report; costUsd: number }> {
  const known = {
    founders: { founders: base.founders, leadershipHires: base.team.leadershipHires },
    investors: { funding: { total: base.funding.total, rounds: base.funding.rounds, investors: base.funding.investors } },
    financials: { financials: base.financials },
    market: { business: base.business },
  }[section];
  const prompt = deepPrompt(section, base.company.name || base.company.domain, base.company.website, new Date().toISOString().slice(0, 10), JSON.stringify(known));
  const prefix = { founders: "df", investors: "di", financials: "dn", market: "dm" }[section];
  const existing = new Set(base.sources.map((s) => normalizeUrl(s.url)));
  const { out, cost, retrieved } = await research(prompt, prefix, existing, { maxSearches: budget(6, 4), maxFetches: budget(3, 2) });

  const d = out.data;
  const next: Json = JSON.parse(JSON.stringify(base));
  const merge = (key: string, fields: Json | undefined) => {
    if (!fields) return;
    const target = (next[key] ?? {}) as Json;
    for (const [k, v] of Object.entries(fields)) {
      // Keep what we had when the deep dive came back empty for a field.
      if (v == null || (Array.isArray(v) && v.length === 0)) continue;
      target[k] = v;
    }
    next[key] = target;
  };
  if (section === "founders") {
    merge("founders", d.founders as Json);
    merge("team", d.team as Json);
  } else if (section === "investors") merge("funding", d.funding as Json);
  else if (section === "financials") merge("financials", d.financials as Json);
  else merge("business", d.business as Json);

  next.sources = [...base.sources, ...out.sources];
  next.deepened = [...new Set([...base.deepened, section])];
  if (out.note) next.notes = [...base.notes, out.note];
  const report = Report.parse(next);
  tidy(report, retrieved, base.company.name);
  console.log(`[deepen] ${base.company.domain} ${section}: $${cost.toFixed(3)}`);
  return { report, costUsd: cost };
}

/** Safety nets applied to every report: short fields stay short, LinkedIn links must be real. */
function tidy(report: Report, retrieved: Set<string>, fallbackName: string) {
  const co = report.company;
  co.name = clip(co.name, 40) || fallbackName;
  co.stage = clip(co.stage, 28);
  co.founded = clip(co.founded, 24);
  co.headquarters = clip(co.headquarters, 48);
  co.industry = clip(co.industry, 56);
  co.tagline = clip(co.tagline, 120);
  for (const f of report.founders.people) f.title = clip(f.title, 40);
  report.team.headcountEstimates = report.team.headcountEstimates.slice(0, 6);
  report.notes = report.notes.slice(0, 4);

  const seen = new Set([...retrieved, ...report.sources.map((s) => normalizeUrl(s.url))]);
  if (co.linkedinUrl && !seen.has(normalizeUrl(co.linkedinUrl))) co.linkedinUrl = "";
  for (const f of report.founders.people) if (f.linkedinUrl && !seen.has(normalizeUrl(f.linkedinUrl))) f.linkedinUrl = "";
  for (const i of report.funding.investors) if (i.linkedinUrl && !seen.has(normalizeUrl(i.linkedinUrl))) i.linkedinUrl = "";
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
