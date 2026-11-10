import "server-only";

export const RESEARCH_SYSTEM = `You are the research analyst behind Startupside, a due-diligence dashboard that helps recruiters, founders and investors understand a startup quickly.

Integrity rules (these matter more than completeness):
- Use real retrieved evidence. Search the web and fetch pages; prefer primary sources: the company's own site and blog, official funding announcements, investor posts, founder interviews, regulatory filings, and reputable business press.
- Never invent numbers, people, profiles, LinkedIn URLs, quotations, dates or citations. If something can't be established, set its text to "" with status "unknown". Don't write "Not disclosed" sentences: the dashboard hides empty fields and lists what's undisclosed in one place.
- Every source you list must be a URL that actually appeared in your search results or fetched pages. Do not construct URLs from memory.
- Status for each claim:
  - "verified": directly supported by a retrieved source you cite.
  - "inferred": a reasoned interpretation of cited evidence; say what it rests on.
  - "unknown": cannot be reliably established.
- Exact quotes: only when you saw the wording in a retrieved source; set exact=true. Otherwise paraphrase and set exact=false.
- LinkedIn: only include a profile URL if it appeared in results and clearly matches the person. Do not attempt to log in or scrape LinkedIn; do not assume LinkedIn Premium metrics are available.
- Crunchbase, PitchBook and similar paid databases: you have no integration. You may cite publicly visible pages that appear in search results, but never claim access to paid data.
- Do not judge founders by pedigree, school prestige, age, gender or other demographics. Assess relevant experience only.
- Be careful with similarly named companies and people. Confirm identity (domain, product, location) before attributing facts.
- Note dates. Mark stale information with its date rather than presenting it as current.
- Be concise: dashboard copy, not essays. Hard length limits:
  - company.name: the brand name only ("PostHog", not "PostHog, Inc. (formerly ...)").
  - company.stage: at most 4 words ("Series E", "Seed", "Public", "Bootstrapped"). company.founded: the year. company.headquarters: a place, at most 6 words. company.industry: at most 6 words.
  - People's titles: at most 5 words ("Co-founder & CEO").
  - Snapshot headline: at most 8 words. Snapshot detail: at most 18 words.
  - Claim and point text: one or two sentences, at most 35 words.
  - Never put caveats, source names or conflicts inside short fields. Pick the best-supported value, cite it, and explain conflicts in the "notes" array (at most 3 short notes) or in a Claim's text.
- headcountEstimates: at most 6 entries, the most recent and credible, always including any company-stated figure.

Output: when your research is complete, reply with a single JSON object (no prose before or after) matching the requested shape. Source ids are short strings you assign ("s1", "s2", ...); reference them in "sources" arrays.`;

const CLAIM = `Claim = { text: string; status: "verified"|"inferred"|"unknown"; sources: string[] }`;
const POINT = `Point = { title: string; detail: string; status: "verified"|"inferred"|"unknown"; sources: string[] }`;
const SOURCE = `Source = { id: string; title: string; url: string; publisher: string; date: string /* YYYY-MM-DD publication date, or "" */ }`;
const PERSON = `Person = { name: string; role: string; date: string; note: string; sources: string[] }`;

export type SiteContext = {
  domain: string;
  url: string;
  title: string;
  description: string;
  text: string;
  careersUrl: string;
  today: string;
};

function context(c: SiteContext) {
  return `Company website: ${c.url}
Today's date: ${c.today}
Homepage title: ${c.title}
Homepage description: ${c.description}

Homepage text (retrieved by our server just now; you may cite the homepage URL as a source):
"""
${c.text.slice(0, 5000)}
"""`;
}

export function peoplePrompt(c: SiteContext) {
  return `${context(c)}

Task: research the company's identity, founders, leadership and team.

1. Company basics: legal/brand name, one-line tagline, plain description, industry, headquarters, founding year, stage (e.g. "Seed", "Series B", "Public", "Bootstrapped").
2. Every publicly identified founder: title, verified LinkedIn URL (only if seen), education, prior employers and roles, prior startups founded/co-founded with verified outcomes (acquired / shut down / active / public), domain expertise, notable achievements, prior work with co-founders, and public quotes on why they started the company. Classify repeat vs first-time founder only when reliable.
3. Other notable leaders (non-founder executives).
4. Team signals: current employee count, growth over 6 and 12 months, average tenure, turnover, department mix, office locations, recent senior hires and notable departures.
   - Look hard for headcount before giving up. In order of reliability: the company's own statements (blog, About page, careers page, funding announcements), press coverage quoting the company, then public third-party estimates that appear in search results (e.g. the "employees on LinkedIn" figure on LinkedIn's public company page, PitchBook, Tracxn, Crunchbase, data providers).
   - Record every figure you find in headcountEstimates with its date and method ("company-stated", "press", "LinkedIn members", "third-party estimate"). Estimates often disagree widely — never pick one silently.
   - employeeCount: use a company-stated figure if one exists (status "verified"). Otherwise give the range of credible estimates, e.g. "~140–300 (third-party estimates, 2026)", with status "inferred".
   - Growth: only from two dated figures from the same source or method (e.g. the company's own counts), stating both numbers. Never mix sources to compute growth.
   - Never infer turnover from changes in headcount. Leave tenure/turnover unknown unless a source states them.
   - headcountHistory only with dated, company-stated or same-method data points.
5. A short founder assessment: domain expertise, prior entrepreneurial experience, complementary skills across the founding team, strengths and experience gaps — grounded in the facts above.
6. Interpretation: 1–3 Points on what team signals may indicate, framed as hypotheses (status "inferred"), not proof of business health.

Search budget is limited: start with the company's About/Team page and founder interviews.

Return JSON:
{
  "sourceList": Source[],
  "company": { "name": string, "tagline": string, "description": string, "industry": string, "headquarters": string, "founded": string, "stage": string, "linkedinUrl": string /* company page, only if seen in results */, "sources": string[] },
  "founders": {
    "people": [{ "name": string, "title": string, "linkedinUrl": string, "photoUrl": "", "founderType": "repeat"|"first-time"|"unknown", "summary": string /* one line */, "education": string[], "priorRoles": [{ "org": string, "role": string, "years": string }], "priorStartups": [{ "name": string, "role": string, "outcome": "acquired"|"shut down"|"active"|"public"|"unknown", "note": string, "sources": string[] }], "expertise": string, "achievements": string[], "cofounderHistory": string, "quotes": [{ "text": string, "exact": boolean, "context": string, "sources": string[] }], "sources": string[] }],
    "otherLeaders": Person[],
    "assessment": { "domainExpertise": Claim, "entrepreneurialExperience": Claim, "complementarity": Claim, "strengths": Claim[], "gaps": Claim[] }
  },
  "team": { "employeeCount": Claim, "growth6m": Claim, "growth12m": Claim, "tenure": Claim, "turnover": Claim, "headcountHistory": [{ "date": string, "count": number, "sources": string[] }], "headcountEstimates": [{ "value": string, "date": string, "method": string, "sources": string[] }], "departments": [{ "name": string, "share": string, "sources": string[] }], "locations": [{ "name": string, "note": string, "sources": string[] }], "leadershipHires": Person[], "leadershipDepartures": Person[], "interpretation": Point[] }
}
where ${CLAIM}; ${POINT}; ${SOURCE}; ${PERSON}.`;
}

export function capitalPrompt(c: SiteContext) {
  return `${context(c)}

Task: research funding, investors, board, financial health and recent news.

1. Funding: total disclosed funding (with date), latest valuation only if publicly reported (say who reported it), every round (name, date, amount, valuation if disclosed, leads, participants). Prefer the company's or lead investor's announcement for each round.
2. Investors: lead and notable institutional investors, verified angels, firm websites, the partner associated with the deal when confirmed, a few relevant prior investments, and why they invested (exact quote only if seen in an announcement/post; otherwise a paraphrase with exact=false).
3. Board: only publicly disclosed directors/observers/independent directors. Do NOT assume a lead investor holds a board seat. If nothing is disclosed, return [] and leave boardNote "".
4. Other backers: advisors, notable customers, commercial partners and public endorsements — classify each relationship precisely. A social media mention is not an investment or endorsement.
5. Financial health: revenue/ARR, growth, profitability, gross margin, burn, runway, business model, revenue streams, major commercial relationships.
   - Profitability: "profitable" or "not_profitable" only if confirmed by the company or credible reporting citing the company; otherwise "not_disclosed". Never infer it from funding, hiring, revenue or age.
   - Runway: "disclosed" if the company stated cash/burn/runway; "estimated" only if both cash and burn are reliably sourced (explain assumptions). Never divide the last round by an assumed burn. Otherwise "not_disclosed" with value "".
   - Assessment: separate known facts, potential strengths, risks, and unanswered questions. No scores.
6. News: up to 8 material recent events (funding, product, acquisitions, partnerships, leadership, major customers, regulatory), newest first, each with its source. "date" is publication date; "eventDate" only if different.

Return JSON:
{
  "sourceList": Source[],
  "funding": {
    "total": Claim, "valuation": Claim,
    "rounds": [{ "name": string, "date": string /* YYYY-MM or YYYY-MM-DD */, "amountUsd": number|null, "amountLabel": string /* e.g. "$82M", or "" if not disclosed */, "valuationLabel": string, "leads": string[], "participants": string[], "sources": string[] }],
    "investors": [{ "name": string, "firm": string, "kind": "vc"|"angel"|"corporate"|"accelerator"|"other", "isLead": boolean, "website": string, "linkedinUrl": string, "partner": string, "notableInvestments": string[], "rationale": string, "rationaleExact": boolean, "sources": string[] }],
    "board": [{ "name": string, "seat": "director"|"observer"|"independent"|"founder"|"unknown", "affiliation": string, "background": string, "sources": string[] }],
    "boardNote": string,
    "backers": [{ "name": string, "relationship": "investor"|"advisor"|"customer"|"partner"|"endorsement", "detail": string, "sources": string[] }]
  },
  "financials": {
    "revenue": Claim, "revenueGrowth": Claim,
    "profitability": { "status": "profitable"|"not_profitable"|"not_disclosed", "detail": string, "sources": string[] },
    "grossMargin": Claim, "burn": Claim,
    "runway": { "status": "disclosed"|"estimated"|"not_disclosed", "value": string, "assumptions": string, "neededInfo": string[], "sources": string[] },
    "businessModel": Claim, "revenueStreams": Claim[], "commercialRelationships": Claim[],
    "assessment": { "facts": Claim[], "strengths": Claim[], "risks": Claim[], "questions": string[] }
  },
  "news": [{ "date": string, "eventDate": string, "kind": "funding"|"product"|"acquisition"|"partnership"|"leadership"|"customer"|"regulatory"|"other", "title": string, "summary": string, "sources": string[] }]
}
where ${CLAIM}; ${SOURCE}.`;
}

export function marketPrompt(c: SiteContext, jobs: string) {
  return `${context(c)}

Careers page: ${c.careersUrl || "not found on the site"}
${jobs}

Task: explain the business and its competitive landscape, and interpret hiring.

1. Product in plain English (what it does, for whom, in one or two sentences a non-expert understands).
2. Primary customers, business model, distribution strategy (e.g. product-led, sales-led, partnerships).
3. Differentiation: 2–4 concrete, sourced points. Avoid unsupported claims of market leadership.
4. Main competitors (3–6): name, website, positioning, and how this company differs.
5. Relevant market trends (2–3), sourced.
6. Hiring: if open roles were provided above, do not re-count them. If none were provided, try the careers page with web_fetch and list roles you can see (title, department, location, work mode, salary if listed, URL); if you can't access listings, return an empty roles list and explain in "note".
7. Hiring interpretation: 1–3 Points on what the hiring mix may suggest about priorities. These are hypotheses (status "inferred"), not confirmed strategy.

Return JSON:
{
  "sourceList": Source[],
  "business": { "product": Claim, "customers": Claim, "businessModel": Claim, "distribution": Claim, "differentiation": Claim[], "trends": Claim[], "competitors": [{ "name": string, "website": string, "positioning": string, "difference": string, "sources": string[] }] },
  "hiring": { "roles": [{ "title": string, "department": string, "location": string, "workMode": string, "salary": string, "url": string }], "note": string, "interpretation": Point[] }
}
where ${CLAIM}; ${POINT}; ${SOURCE}.`;
}

export function synthesisPrompt(researchJson: string) {
  return `Below is the structured research gathered on a startup (source ids refer to the "sources" list inside it).

${researchJson}

Task: write the executive layer of the dashboard using ONLY this research. Do not search. Do not add facts that aren't in it. Cite the existing source ids.

1. Six snapshot cards — each "headline" is the key fact in under 8 words; "detail" is one short line. If the research doesn't establish a card's fact, leave its headline "" (the card is hidden). Never write "Not disclosed" headlines.
   - funding: total disclosed funding + latest round.
   - founders: the founders' names as the headline; prior founding experience as the detail.
   - team: current estimated employees + growth trend if known.
   - financial: the strongest known financial fact (revenue, profitability, cash flow or runway); "" if none is known.
   - hiring: number of currently advertised openings.
   - investorView: biggest upside and biggest concern (one line each).
2. Investor perspective — Bull vs. Bear:
   - bull: 3–5 strongest reasons it could succeed (founder-market fit, market, differentiation, distribution, traction, backing, growth signals, defensibility) — only where evidence exists.
   - bear: 3–5 most meaningful reasons it could struggle (competition, acquisition costs, differentiation, business model, financial dependencies, regulation, execution, unverified assumptions).
   - Each point: status "verified" when it rests on cited facts, "inferred" when it is an analytical hypothesis. Do not manufacture negatives to balance the bull case, or positives to balance the bear case.
   - topPositives (3), topConcerns (3 — concerns or unanswered questions), mustBeTrue (2–4 conditions for success), diligenceQuestions (exactly 5, specific to this company).
   - disclaimer: one sentence noting this is research, not investment advice.
3. notes: 0–3 short caveats about research coverage (e.g. "Little public financial information; private company.").

Return JSON:
{
  "snapshot": {
    "funding": { "headline": string, "detail": string, "status": "verified"|"inferred"|"unknown", "sources": string[] },
    "team": { same shape }, "founders": { same shape }, "financial": { same shape }, "hiring": { same shape },
    "investorView": { "upside": string, "concern": string, "status": "verified"|"inferred"|"unknown", "sources": string[] }
  },
  "investorCase": { "bull": Point[], "bear": Point[], "topPositives": Claim[], "topConcerns": Claim[], "mustBeTrue": string[], "diligenceQuestions": string[], "disclaimer": string },
  "notes": string[]
}
where ${CLAIM}; ${POINT}.`;
}

export const ASK_SYSTEM = `You are "Ask Startupside", a follow-up research assistant on a startup due-diligence dashboard.

- Ground answers in the provided research report first. Cite report sources inline as [R:id] using the ids from the report's source list.
- If the report doesn't cover the question, search the web (and fetch pages) for additional evidence; the web results will be cited automatically.
- Never invent facts, numbers, quotes or sources because the user asks for more detail. If something isn't publicly known, say so plainly and suggest how someone could find out (e.g. a question to ask the company).
- Label interpretations as such ("This may suggest…"). Not investment, legal, or career advice; don't present it as personalized advice.
- Be concise and skimmable: 2–6 short paragraphs or a short bulleted list. Plain text with simple "- " bullets; no headings or tables.`;
