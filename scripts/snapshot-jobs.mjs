// Refreshes the hiring data bundled with the sample reports from public Ashby boards.
// Usage: node scripts/snapshot-jobs.mjs ramp linear resend
import { writeFileSync } from "node:fs";

for (const slug of process.argv.slice(2)) {
  const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`);
  const data = await res.json();
  const roles = (data.jobs ?? [])
    .filter((j) => j.isListed !== false)
    .map((j) => ({
      title: j.title.trim(),
      department: j.department || j.team || "Other",
      location: j.location || "",
      workMode: j.workplaceType || (j.isRemote ? "Remote" : ""),
      salary: j.compensation?.scrapeableCompensationSalarySummary || j.compensation?.compensationTierSummary || "",
      url: j.jobUrl || `https://jobs.ashbyhq.com/${slug}`,
    }));
  const out = { checkedAt: new Date().toISOString().slice(0, 10), boardUrl: `https://jobs.ashbyhq.com/${slug}`, roles };
  writeFileSync(`src/data/samples/hiring-${slug}.json`, JSON.stringify(out, null, 1));
  const by = {};
  for (const r of roles) by[r.department] = (by[r.department] ?? 0) + 1;
  const modes = {};
  for (const r of roles) modes[r.workMode || "-"] = (modes[r.workMode || "-"] ?? 0) + 1;
  const locs = {};
  for (const r of roles) locs[r.location] = (locs[r.location] ?? 0) + 1;
  console.log(slug, roles.length, JSON.stringify(by), JSON.stringify(modes), "salaries:", roles.filter((r) => r.salary).length);
  console.log("  top locations", JSON.stringify(Object.entries(locs).sort((a, b) => b[1] - a[1]).slice(0, 6)));
}
