# Startupside

**Know the startup behind the pitch.** Enter a company website and get a due-diligence dashboard: founders, investors and funding, team growth, hiring, financial health (with honest unknowns), competitors, a bull vs. bear investor view, and recent news. Every claim links to its source.

- Three **sample reports** (Ramp, Linear, Resend) work with no API key and no cost.
- **Live research** uses Claude with web search and web fetch, plus public job-board APIs.
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

Live reports can take 1–3 minutes, and the app asks Vercel for up to 300 seconds per request. That's within the default limits on current Vercel plans. If reports time out, check **Settings → Functions → Max Duration**.

## 3. Cost controls

| Control | Default | Setting |
|---|---|---|
| Global daily spending cap (all visitors) | $2 | `DAILY_SPEND_CAP_USD` |
| New live reports per visitor per hour | 3 | `ANALYZE_LIMIT_PER_HOUR` |
| Follow-up questions per visitor per hour | 20 | `ASK_LIMIT_PER_HOUR` |
| Report cache (repeat visits are free) | 7 days | `REPORT_CACHE_DAYS` |
| Turn live research off entirely | on | `LIVE_RESEARCH_ENABLED=false` |

The API isn't free: add credits in the Anthropic Console (Settings → Billing). By default the app uses **Claude Haiku 5.5**, the cheapest model. A live report costs an estimated **$0.20–0.40** (a test report on PostHog cost $0.32), so $5 of credit covers roughly 12–25 reports. Follow-up questions cost about a cent or two each.

For deeper research and analysis, set `ANTHROPIC_MODEL` to `claude-sonnet-5-5` (~$0.50–1.50 per report) or `claude-opus-5-5` (~$1–3). These also use newer web-search tools that filter results more precisely. If you switch, raise `DAILY_SPEND_CAP_USD` too. The app's cap is calculated from token usage. **Also set a monthly spend limit in the Anthropic Console** (Settings → Limits) as a hard backstop.

## 4. How it works

```
website ─► safe fetch of homepage + careers page (blocks private networks, size/time limits)
        ─► public job-board APIs (Ashby, Greenhouse, Lever) → exact open-role counts
        ─► 3 parallel Claude research agents with web search + fetch
             • founders & team   • funding, board & financials   • market & hiring
        ─► citation check: sources whose URL never appeared in real search/fetch
           results are dropped, and "verified" claims left without evidence are downgraded
        ─► 1 synthesis pass (no web access) → snapshot cards + bull/bear case
        ─► schema validation (zod) → cached → streamed to the browser with live progress
```

Key files:

- `src/lib/pipeline.ts`: orchestration and citation checking
- `src/lib/prompts.ts`: research rules (no invented numbers, quotes or LinkedIn URLs; runway and profitability rules)
- `src/lib/schema.ts`: the report structure
- `src/lib/jobs.ts`, `src/lib/site.ts`, `src/lib/safe-fetch.ts`: deterministic data gathering
- `src/lib/limits.ts`, `src/lib/store.ts`: rate limits, spending cap, cache
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
