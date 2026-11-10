import "server-only";
import { safeFetchJson } from "./safe-fetch";

/**
 * Reads open roles from the public job-board APIs that most startups use
 * (Ashby, Greenhouse, Lever). These endpoints are published for exactly this
 * purpose, so the counts are exact rather than AI estimates.
 */

export type Role = { title: string; department: string; location: string; workMode: string; salary: string; url: string };
export type JobBoard = {
  provider: "Ashby" | "Greenhouse" | "Lever";
  slug: string;
  boardUrl: string;
  matchedBy: "link" | "name";
  roles: Role[];
};

type AshbyJob = {
  title: string;
  department?: string;
  team?: string;
  location?: string;
  isRemote?: boolean;
  workplaceType?: string;
  jobUrl?: string;
  isListed?: boolean;
  compensation?: { compensationTierSummary?: string; scrapeableCompensationSalarySummary?: string };
};

async function ashby(slug: string): Promise<Role[] | null> {
  const data = await safeFetchJson<{ jobs?: AshbyJob[] }>(
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`,
  );
  if (!data?.jobs) return null;
  return data.jobs
    .filter((j) => j.isListed !== false)
    .map((j) => ({
      title: j.title,
      department: j.department || j.team || "Other",
      location: j.location || "",
      workMode: j.workplaceType || (j.isRemote ? "Remote" : ""),
      salary: j.compensation?.scrapeableCompensationSalarySummary || j.compensation?.compensationTierSummary || "",
      url: j.jobUrl || `https://jobs.ashbyhq.com/${slug}`,
    }));
}

type GhDept = { name: string; jobs: { title: string; location?: { name?: string }; absolute_url: string }[] };

async function greenhouse(slug: string): Promise<Role[] | null> {
  const data = await safeFetchJson<{ departments?: GhDept[] }>(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/departments`,
  );
  if (!data?.departments) return null;
  const seen = new Set<string>();
  const roles: Role[] = [];
  for (const d of data.departments) {
    for (const j of d.jobs ?? []) {
      if (seen.has(j.absolute_url)) continue;
      seen.add(j.absolute_url);
      const loc = j.location?.name ?? "";
      roles.push({
        title: j.title,
        department: d.name || "Other",
        location: loc,
        workMode: /remote/i.test(loc) ? "Remote" : /hybrid/i.test(loc) ? "Hybrid" : "",
        salary: "",
        url: j.absolute_url,
      });
    }
  }
  return roles;
}

type LeverPosting = {
  text: string;
  hostedUrl: string;
  workplaceType?: string;
  categories?: { team?: string; department?: string; location?: string };
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
};

async function lever(slug: string): Promise<Role[] | null> {
  const data = await safeFetchJson<LeverPosting[]>(`https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`);
  if (!Array.isArray(data)) return null;
  return data.map((p) => {
    const s = p.salaryRange;
    const salary =
      s?.min && s?.max
        ? `${s.currency ?? ""} ${s.min.toLocaleString()}–${s.max.toLocaleString()}${s.interval ? ` ${s.interval.replace("-", " ")}` : ""}`.trim()
        : "";
    return {
      title: p.text,
      department: p.categories?.department || p.categories?.team || "Other",
      location: p.categories?.location || "",
      workMode: p.workplaceType && p.workplaceType !== "unspecified" ? p.workplaceType : "",
      salary,
      url: p.hostedUrl,
    };
  });
}

const PROVIDERS = {
  Ashby: { read: ashby, board: (s: string) => `https://jobs.ashbyhq.com/${s}` },
  Greenhouse: { read: greenhouse, board: (s: string) => `https://job-boards.greenhouse.io/${s}` },
  Lever: { read: lever, board: (s: string) => `https://jobs.lever.co/${s}` },
} as const;

function slugsFromLinks(links: string[]): { provider: keyof typeof PROVIDERS; slug: string }[] {
  const found: { provider: keyof typeof PROVIDERS; slug: string }[] = [];
  for (const l of links) {
    let m = l.match(/jobs\.ashbyhq\.com\/([^/?#]+)/i);
    if (m) found.push({ provider: "Ashby", slug: decodeURIComponent(m[1]) });
    m = l.match(/(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board\?for=)?([^/?#&]+)/i);
    if (m && m[1] !== "embed") found.push({ provider: "Greenhouse", slug: m[1] });
    m = l.match(/[?&]for=([^&#]+)/i);
    if (m && /greenhouse/i.test(l)) found.push({ provider: "Greenhouse", slug: m[1] });
    m = l.match(/jobs\.lever\.co\/([^/?#]+)/i);
    if (m) found.push({ provider: "Lever", slug: m[1] });
  }
  const key = (f: { provider: string; slug: string }) => `${f.provider}:${f.slug.toLowerCase()}`;
  return [...new Map(found.map((f) => [key(f), f])).values()].slice(0, 4);
}

export async function findJobBoard(domain: string, links: string[]): Promise<JobBoard | null> {
  for (const { provider, slug } of slugsFromLinks(links)) {
    const roles = await PROVIDERS[provider].read(slug);
    if (roles) return { provider, slug, boardUrl: PROVIDERS[provider].board(slug), matchedBy: "link", roles };
  }
  // No board linked from the site: try the obvious slug on each provider.
  // Name matches can collide with another company, so they are flagged.
  const guess = domain.split(".")[0].replace(/[^a-z0-9-]/g, "");
  if (guess.length < 3) return null;
  const attempts = await Promise.all(
    (Object.keys(PROVIDERS) as (keyof typeof PROVIDERS)[]).map(async (provider) => ({
      provider,
      roles: await PROVIDERS[provider].read(guess),
    })),
  );
  const hit = attempts.find((a) => a.roles && a.roles.length > 0);
  return hit
    ? { provider: hit.provider, slug: guess, boardUrl: PROVIDERS[hit.provider].board(guess), matchedBy: "name", roles: hit.roles! }
    : null;
}
