# Startupside

**Live demo:** https://startupside.vercel.app

**Know the startup behind the pitch.** Enter a company website and get a due-diligence dashboard: founders, investors and funding, team growth, hiring, financial health (with honest unknowns), competitors, a bull vs. bear investor view, and recent news. Every claim links to its source.

- Three **sample reports** (Ramp, Linear, Resend) work with no API key and no cost.
- **Live research** uses Claude with web search and web fetch, plus public job-board APIs. One quick research pass covers every section; **"Research deeper"** buttons on founders, investors, financials and competitors run more research only when someone clicks them.
- **Ask Startupside** answers follow-up questions from the report and new web research.
- **Headcount from public sources**: company statements first, then press and third-party estimates (PitchBook, Tracxn, LinkedIn member counts in search results). Estimates are shown side by side with their dates and methods, since they often disagree.
- A one-click **"View insights on LinkedIn"** link to the company's LinkedIn page, where Premium members can see headcount growth and tenure. The app never logs in to LinkedIn or copies its data.

---

## 1. Run it on your computer

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
```

```bash
cp .env.example .env.local
```

Open `.env.local` and paste your Anthropic API key after `ANTHROPIC_API_KEY=`. Get a key at https://console.anthropic.com under **API Keys**. Without a key, only the sample reports work.

```bash
npm run dev
```

Open http://localhost:3000.

## 2. Deploy to Vercel

1. Put this folder in a GitHub repository. GitHub Desktop is the easiest way: **File → Add local repository**, then **Publish repository**.
2. At https://vercel.com/new, import that repository. Vercel detects Next.js automatically.
3. Before you click **Deploy**, open **Environment Variables** and add `ANTHROPIC_API_KEY`. Add `DAILY_SPEND_CAP_USD` too if you want a cap other than $2/day.
4. Click **Deploy**.
5. **Recommended:** in the Vercel project, open **Storage → Create → Upstash (Redis)**, connect it to the project, and redeploy. Without it, each server instance keeps its own cache and counters, so the daily cap and rate limits are only approximate.

Live reports take about a minute and a half, and the app asks Vercel for up to 300 seconds per request. That's within the default limits on current Vercel plans. If reports time out, check **Settings → Functions → Max Duration**.

## 3. Cost controls

| Control | Default | Setting |
|---|---|---|
| Global daily spending cap (all visitors) | $2 | `DAILY_SPEND_CAP_USD` |
| New live reports per visitor per hour | 3 | `ANALYZE_LIMIT_PER_HOUR` |
| Follow-up questions per visitor per hour | 20 | `ASK_LIMIT_PER_HOUR` |
| Deeper research clicks per visitor per hour | 12 | `DEEPEN_LIMIT_PER_HOUR` |
| Report cache on the server (repeat visits are free) | 14 days | `REPORT_CACHE_DAYS` |
| Turn live research off entirely | on | `LIVE_RESEARCH_ENABLED=false` |

The API isn't free: add credits in the Anthropic Console (Settings → Billing). How the app keeps costs low:

- **One research pass per report.** It gathers the essentials for every section in a single search session instead of researching each section separately.
- **Research on demand.** Founders, investors, financials and competitors each have a "Research deeper" button, so that research only runs (and costs) when someone wants it.
- **A cheap model for gathering facts, a stronger one for judgment.** Claude Haiku 5.5 does the web research and extraction (`RESEARCH_MODEL`); Claude Sonnet 5.5 writes the snapshot cards and the bull vs. bear analysis from those facts (`ANALYSIS_MODEL`).
- **Caching.** A finished report is reused for 14 days, on the server and in each visitor's browser, so looking up the same company again is free. Deep-dive results are saved into the cached report.

Measured costs: a new report on Supabase cost **$0.11**, and a "Research deeper" click about **$0.05**. Follow-up questions cost a cent or two. $5 of credit covers roughly 40 reports.

The app's spending cap is calculated from token usage. **Also set a monthly spend limit in the Anthropic Console** (Settings → Limits) as a hard backstop.

## 4. How it works

```
website ─► safe fetch of homepage + careers page (blocks private networks, size/time limits)
        ─► public job-board APIs (Ashby, Greenhouse, Lever) → exact open-role counts
        ─► 1 research pass (Claude Haiku 5.5 + web search/fetch) for every section's essentials
        ─► citation check: sources whose URL never appeared in real search/fetch
           results are dropped, and "verified" claims left without evidence are downgraded
        ─► 1 analysis pass (Claude Sonnet 5.5, no web access) → snapshot cards + bull/bear case
        ─► schema validation (zod) → cached (server + browser) → streamed with live progress

on click ─► "Research deeper" on founders / investors / financials / competitors
        ─► focused research pass → citation check → merged into the cached report
```

Key files:

- `src/lib/pipeline.ts`: orchestration and citation checking
- `src/lib/prompts.ts`: research rules (no invented numbers, quotes or LinkedIn URLs; runway and profitability rules)
- `src/lib/schema.ts`: the report structure
- `src/lib/jobs.ts`, `src/lib/site.ts`, `src/lib/safe-fetch.ts`: deterministic data gathering
- `src/lib/limits.ts`, `src/lib/store.ts`, `src/lib/report-cache.ts`: rate limits, spending cap, cache
- `src/app/api/deepen/route.ts`, `src/components/Deepen.tsx`: on-demand deep research
- `src/data/samples/`: the three pre-researched sample reports

### Data integrity rules

- Every claim is labeled **Verified** (cited source), **Inferred** (reasoned from cited evidence) or **Unknown**.
- Missing data shows as "Not disclosed". Third-party headcount estimates are shown as a labeled range, never as an official number. Profitability is shown only when the company or credible reporting confirms it. Runway is never estimated by dividing the last round by a guessed burn rate.
- No logins, scraping behind logins, or paid databases (LinkedIn Premium, Crunchbase, PitchBook).

## 5. Refreshing the sample reports

The samples were researched on Nov 9, 2026. Their hiring data comes from each company's public Ashby job board. To refresh the open roles:

```bash
node scripts/snapshot-jobs.mjs ramp linear resend
```

Other figures (funding, valuations, revenue) are written by hand in `src/data/samples/*.ts` with their sources. Update them there.
