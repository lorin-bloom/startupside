"use client";

import { useMemo, useState } from "react";
import type { Claim, Founder, Point, Report } from "@/lib/schema";
import { FundingBars, HBars, HeadcountLine } from "./charts";
import {
  Card,
  Cite,
  ClaimText,
  Disclosure,
  ExternalLink,
  Initials,
  Label,
  Section,
  StatusDot,
  Tag,
  formatDate,
  hostOf,
  isEmptyText,
} from "./ui";

/* ================= Founders ================= */

const OUTCOME_TONE = { acquired: "bull", public: "bull", active: "accent", "shut down": "bear", unknown: "neutral" } as const;

function FounderCard({ f }: { f: Founder }) {
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start gap-3">
        <Initials name={f.name} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-[17px] font-semibold tracking-tight">{f.name}</h3>
            {f.founderType === "repeat" && <Tag tone="accent">Repeat founder</Tag>}
            {f.founderType === "first-time" && <Tag>First-time founder</Tag>}
          </div>
          <p className="text-[13px] text-muted">
            {f.title}
            {f.linkedinUrl && (
              <>
                {" · "}
                <ExternalLink href={f.linkedinUrl}>LinkedIn</ExternalLink>
              </>
            )}
          </p>
        </div>
      </div>
      {f.summary && (
        <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
          {f.summary}
          <Cite ids={f.sources} />
        </p>
      )}
      {f.priorStartups.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {f.priorStartups.map((s) => (
            <Tag key={s.name} tone={OUTCOME_TONE[s.outcome]}>
              {s.name} · {s.outcome === "unknown" ? "outcome unverified" : s.outcome}
            </Tag>
          ))}
        </div>
      )}
      <div className="mt-auto pt-4">
        <Disclosure label="Background">
          <dl className="space-y-3 text-[13.5px] leading-relaxed">
            {f.priorRoles.length > 0 && (
              <div>
                <Label>Experience</Label>
                <ul className="mt-1 space-y-0.5">
                  {f.priorRoles.map((r, i) => (
                    <li key={i}>
                      <span className="font-medium">{r.org}</span> <span className="text-muted">— {r.role}</span>
                      {r.years && <span className="text-faint"> · {r.years}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {f.priorStartups.length > 0 && (
              <div>
                <Label>Previous startups</Label>
                <ul className="mt-1 space-y-1">
                  {f.priorStartups.map((s) => (
                    <li key={s.name}>
                      <span className="font-medium">{s.name}</span> <span className="text-muted">({s.role})</span> — {s.note}
                      <Cite ids={s.sources} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {f.education.length > 0 && (
              <div>
                <Label>Education</Label>
                <p className="mt-1">{f.education.join(" · ")}</p>
              </div>
            )}
            {f.expertise && (
              <div>
                <Label>Expertise</Label>
                <p className="mt-1">{f.expertise}</p>
              </div>
            )}
            {f.achievements.length > 0 && (
              <div>
                <Label>Notable</Label>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {f.achievements.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
            {f.cofounderHistory && (
              <div>
                <Label>With co-founders</Label>
                <p className="mt-1">{f.cofounderHistory}</p>
              </div>
            )}
            {f.quotes.map((q, i) => (
              <blockquote key={i} className="border-l-2 border-accent/40 pl-3">
                <p className={q.exact ? "font-serif text-[16px] leading-snug" : "italic text-ink-2"}>
                  {q.exact ? `“${q.text}”` : q.text}
                  <Cite ids={q.sources} />
                </p>
                <p className="mt-1 text-xs text-muted">
                  {q.exact ? "" : "Paraphrased · "}
                  {q.context}
                </p>
              </blockquote>
            ))}
          </dl>
        </Disclosure>
      </div>
    </Card>
  );
}

function AssessRow({ label, claim }: { label: string; claim: Claim }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[180px_1fr] sm:gap-6">
      <Label>{label}</Label>
      <ClaimText claim={claim} className="text-[14px] leading-relaxed" />
    </div>
  );
}

export function FoundersSection({ r }: { r: Report }) {
  const { people, otherLeaders, assessment } = r.founders;
  const repeat = people.filter((p) => p.founderType === "repeat").length;
  return (
    <Section
      id="founders"
      eyebrow="02 · Founders & leadership"
      title="Who built it"
      summary={
        people.length ? (
          <>
            {people.length} publicly identified founder{people.length > 1 ? "s" : ""}
            {repeat ? `, ${repeat} with prior founding experience.` : "."} Assessment is based on relevant experience only — not pedigree.
          </>
        ) : (
          "No founders could be identified from public sources."
        )
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {people.map((f) => (
          <FounderCard key={f.name} f={f} />
        ))}
      </div>

      <Card className="mt-4 px-5 py-2">
        <div className="divide-y divide-line">
          <AssessRow label="Domain expertise" claim={assessment.domainExpertise} />
          <AssessRow label="Founding experience" claim={assessment.entrepreneurialExperience} />
          <AssessRow label="Team complementarity" claim={assessment.complementarity} />
          {(assessment.strengths.length > 0 || assessment.gaps.length > 0) && (
            <div className="grid gap-4 py-4 sm:grid-cols-2">
              <ClaimList title="Strengths" items={assessment.strengths} />
              <ClaimList title="Gaps to probe" items={assessment.gaps} />
            </div>
          )}
        </div>
      </Card>

      {otherLeaders.length > 0 && (
        <div className="mt-5">
          <Disclosure label={`Other leadership (${otherLeaders.length})`}>
            <ul className="grid gap-2 sm:grid-cols-2">
              {otherLeaders.map((p) => (
                <li key={p.name} className="text-[14px]">
                  <span className="font-medium">{p.name}</span> <span className="text-muted">— {p.role}</span>
                  <Cite ids={p.sources} />
                </li>
              ))}
            </ul>
          </Disclosure>
        </div>
      )}
    </Section>
  );
}

function ClaimList({ title, items, tone }: { title: string; items: Claim[]; tone?: "bull" | "bear" }) {
  if (!items.length) return null;
  return (
    <div>
      <p className={`mb-2 text-[13px] font-semibold ${tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : "text-ink"}`}>{title}</p>
      <ul className="space-y-2 text-[14px] leading-relaxed">
        {items.map((c, i) => (
          <li key={i}>
            <ClaimText claim={c} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ================= Team ================= */

function Stat({ label, claim, big = false }: { label: string; claim: Claim; big?: boolean }) {
  const empty = isEmptyText(claim.text);
  return (
    <div className="min-w-0">
      <Label>{label}</Label>
      <p className={`mt-1.5 leading-snug ${big ? "font-serif text-[1.65rem] leading-tight" : "text-[14px]"} ${empty ? "text-faint" : ""}`}>
        {!empty && !big && <StatusDot status={claim.status} className="mr-1.5 -translate-y-[2px]" />}
        {empty ? (big ? "Not disclosed" : claim.text || "Not disclosed") : claim.text}
        {!empty && <Cite ids={claim.sources} />}
      </p>
    </div>
  );
}

export function TeamSection({ r }: { r: Report }) {
  const t = r.team;
  const departmentsFromRoles = useMemo(() => countBy(r.hiring.roles.map((x) => x.department)), [r.hiring.roles]);
  return (
    <Section
      id="team"
      eyebrow="03 · Team"
      title="How the team is growing"
      summary="Public signals only. Hiring and departures are hints about a company's direction, not proof of its health."
    >
      <Card className="grid grid-cols-2 gap-x-6 gap-y-6 p-5 sm:grid-cols-4">
        <Stat label="Employees" claim={t.employeeCount} />
        <Stat label="6-month growth" claim={t.growth6m} />
        <Stat label="12-month growth" claim={t.growth12m} />
        <Stat label="Average tenure" claim={t.tenure} />
      </Card>

      {t.headcountEstimates.length > 0 && (
        <div className="mt-3 px-1">
          <Disclosure label={`Compare ${t.headcountEstimates.length} headcount figure${t.headcountEstimates.length > 1 ? "s" : ""}`}>
            <Card className="overflow-hidden">
              <ul className="divide-y divide-line">
                {t.headcountEstimates.map((e, i) => (
                  <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-5 py-2.5 text-[14px]">
                    <span>
                      <span className="tabular font-medium">{e.value}</span>
                      {e.date && <span className="text-muted"> · {formatDate(e.date)}</span>}
                      <Cite ids={e.sources} />
                    </span>
                    <span className="text-[12.5px] text-muted">{e.method}</span>
                  </li>
                ))}
              </ul>
              <p className="border-t border-line bg-paper/60 px-5 py-2.5 text-[12.5px] leading-relaxed text-muted">
                Data providers count differently (LinkedIn profiles, job posts, filings) and often disagree. Treat third-party figures as a rough range.
              </p>
            </Card>
          </Disclosure>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {t.headcountHistory.length >= 2 && (
          <Card className="p-5">
            <Label>Headcount over time</Label>
            <div className="mt-3">
              <HeadcountLine points={t.headcountHistory} />
            </div>
            <p className="mt-2 text-xs text-muted">
              Dated, sourced data points only
              <Cite ids={[...new Set(t.headcountHistory.flatMap((p) => p.sources))]} />
            </p>
          </Card>
        )}
        {departmentsFromRoles.length > 0 && (
          <Card className="p-5">
            <Label>Open roles by function</Label>
            <div className="mt-3">
              <HBars items={departmentsFromRoles.slice(0, 8)} />
            </div>
            <p className="mt-2 text-xs text-muted">From the hiring data below — not the current team mix.</p>
          </Card>
        )}
        {t.departments.length > 0 && (
          <Card className="p-5">
            <Label>Team by department</Label>
            <ul className="mt-3 space-y-1.5 text-[14px]">
              {t.departments.map((d) => (
                <li key={d.name} className="flex justify-between gap-4">
                  <span>{d.name}</span>
                  <span className="tabular text-muted">
                    {d.share}
                    <Cite ids={d.sources} />
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {t.locations.length > 0 && (
          <Card className="p-5">
            <Label>Where they work</Label>
            <ul className="mt-3 space-y-2 text-[14px]">
              {t.locations.map((l) => (
                <li key={l.name}>
                  <span className="font-medium">{l.name}</span>
                  {l.note && <span className="text-muted"> — {l.note}</span>}
                  <Cite ids={l.sources} />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {(t.leadershipHires.length > 0 || t.leadershipDepartures.length > 0) && (
        <Card className="mt-4 grid gap-6 p-5 sm:grid-cols-2">
          <PeopleList title="Senior hires" items={t.leadershipHires} tone="bull" />
          <PeopleList title="Leadership departures" items={t.leadershipDepartures} tone="bear" />
        </Card>
      )}

      {t.interpretation.length > 0 && <Signals title="What these signals may suggest" points={t.interpretation} />}

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
        <span>
          <StatusDot status="unknown" className="mr-1.5 -translate-y-[2px]" />
          Turnover: {t.turnover.text || "Not disclosed"}
        </span>
      </div>

      <LinkedInInsights r={r} />
    </Section>
  );
}

/**
 * One click to the company's LinkedIn page, where Premium members can open the
 * Insights tab (headcount growth, tenure, department mix). Nothing is copied.
 */
function LinkedInInsights({ r }: { r: Report }) {
  const name = r.company.name || r.company.domain;
  const href =
    r.company.linkedinUrl || `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(name)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group mt-4 flex items-center justify-between gap-4 rounded-2xl border border-line bg-card px-5 py-4 transition hover:border-accent"
    >
      <span>
        <span className="block text-[14.5px] font-medium">View {name}&apos;s insights on LinkedIn</span>
        <span className="mt-0.5 block text-[13px] text-muted">
          {r.company.linkedinUrl ? "Company page" : "Company search"} · with Premium, the Insights tab shows headcount growth, tenure and team mix
        </span>
      </span>
      <span className="shrink-0 text-accent transition group-hover:translate-x-0.5" aria-hidden>
        ↗
      </span>
    </a>
  );
}

function PeopleList({ title, items, tone }: { title: string; items: Report["team"]["leadershipHires"]; tone: "bull" | "bear" }) {
  return (
    <div>
      <p className={`mb-2 text-[13px] font-semibold ${tone === "bull" ? "text-bull" : "text-bear"}`}>{title}</p>
      {items.length ? (
        <ul className="space-y-2 text-[14px]">
          {items.map((p) => (
            <li key={p.name + p.role}>
              <span className="font-medium">{p.name}</span> <span className="text-muted">— {p.role}</span>
              {p.date && <span className="text-faint"> · {formatDate(p.date)}</span>}
              <Cite ids={p.sources} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-faint">None found in public sources</p>
      )}
    </div>
  );
}

function Signals({ title, points }: { title: string; points: Point[] }) {
  return (
    <div className="mt-4 rounded-2xl bg-accent-soft/60 p-5">
      <p className="text-[13px] font-semibold text-accent">{title}</p>
      <ul className="mt-2 space-y-2.5">
        {points.map((p, i) => (
          <li key={i} className="text-[14px] leading-relaxed">
            <span className="font-medium">{p.title}.</span> <span className="text-ink-2">{p.detail}</span>
            <Cite ids={p.sources} />
            {p.status === "inferred" && <span className="ml-1.5 text-xs text-inferred">Hypothesis</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function countBy(values: string[]) {
  const m = new Map<string, number>();
  for (const v of values) m.set(v || "Other", (m.get(v || "Other") ?? 0) + 1);
  return [...m].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

/* ================= Investors ================= */

const KIND_LABEL = { vc: "Venture", angel: "Angel", corporate: "Corporate", accelerator: "Accelerator", other: "Other" };
const REL_LABEL = { investor: "Investors", advisor: "Advisors", customer: "Customers", partner: "Partners", endorsement: "Public endorsements" };

export function InvestorsSection({ r }: { r: Report }) {
  const f = r.funding;
  const latestIdx = useMemo(() => {
    let best = 0;
    f.rounds.forEach((x, i) => {
      if (x.date > (f.rounds[best]?.date ?? "")) best = i;
    });
    return best;
  }, [f.rounds]);
  const [sel, setSel] = useState(latestIdx);
  const round = f.rounds[sel];
  const backers = useMemo(() => {
    const groups = new Map<string, Report["funding"]["backers"]>();
    for (const b of f.backers) groups.set(b.relationship, [...(groups.get(b.relationship) ?? []), b]);
    return [...groups];
  }, [f.backers]);

  return (
    <Section
      id="investors"
      eyebrow="04 · Investors & board"
      title="Who backs it"
      summary={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <div>
            <Label>Total disclosed</Label>
            <p className="mt-1 font-serif text-[1.65rem] leading-tight">
              <ClaimText claim={f.total} />
            </p>
          </div>
          <div>
            <Label>Latest valuation</Label>
            <p className="mt-1 font-serif text-[1.65rem] leading-tight">
              <ClaimText claim={f.valuation} />
            </p>
          </div>
        </div>
      }
    >
      {f.rounds.length > 0 && (
        <Card className="grid gap-6 p-5 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <Label>Funding rounds · click a bar</Label>
            <div className="mt-4">
              <FundingBars rounds={f.rounds} selected={sel} onSelect={setSel} />
            </div>
          </div>
          {round && (
            <div key={sel} className="rise rounded-xl bg-paper p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-faint">{formatDate(round.date)}</p>
              <p className="mt-1 font-serif text-2xl">{round.name}</p>
              <p className="mt-1 text-[15px]">
                {round.amountLabel || "Amount undisclosed"}
                {round.valuationLabel && <span className="text-muted"> · {round.valuationLabel} valuation</span>}
                <Cite ids={round.sources} />
              </p>
              {round.leads.length > 0 && (
                <p className="mt-3 text-[13.5px]">
                  <span className="text-muted">Led by </span>
                  {round.leads.join(", ")}
                </p>
              )}
              {round.participants.length > 0 && (
                <p className="mt-1 text-[13.5px] text-muted">With {round.participants.join(", ")}</p>
              )}
            </div>
          )}
        </Card>
      )}

      {f.investors.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {f.investors.map((inv) => (
            <Card key={inv.name} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold tracking-tight">
                    <ExternalLink href={inv.website}>{inv.name}</ExternalLink>
                  </p>
                  <p className="text-[12.5px] text-muted">
                    {KIND_LABEL[inv.kind]}
                    {inv.partner && ` · ${inv.partner}`}
                    {inv.linkedinUrl && (
                      <>
                        {" · "}
                        <ExternalLink href={inv.linkedinUrl}>LinkedIn</ExternalLink>
                      </>
                    )}
                  </p>
                </div>
                {inv.isLead && <Tag tone="accent">Lead</Tag>}
              </div>
              {inv.rationale && (
                <p className={`mt-3 text-[13.5px] leading-relaxed ${inv.rationaleExact ? "font-serif text-[15.5px] leading-snug" : "text-ink-2"}`}>
                  {inv.rationaleExact ? `“${inv.rationale}”` : inv.rationale}
                  <Cite ids={inv.sources} />
                </p>
              )}
              {inv.notableInvestments.length > 0 && (
                <p className="mt-2 text-xs text-muted">Also backed: {inv.notableInvestments.join(", ")}</p>
              )}
            </Card>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <Label>Board of directors</Label>
          {f.board.length ? (
            <ul className="mt-3 space-y-2 text-[14px]">
              {f.board.map((b) => (
                <li key={b.name}>
                  <span className="font-medium">{b.name}</span>{" "}
                  <span className="text-muted">
                    — {b.seat === "unknown" ? "role unconfirmed" : b.seat}
                    {b.affiliation && `, ${b.affiliation}`}
                  </span>
                  <Cite ids={b.sources} />
                  {b.background && <p className="text-[13px] text-muted">{b.background}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[14px] text-faint">Not publicly disclosed</p>
          )}
          {f.boardNote && <p className="mt-3 text-[13px] leading-relaxed text-muted">{f.boardNote}</p>}
        </Card>
        {backers.length > 0 && (
          <Card className="p-5">
            <Label>Other backers & relationships</Label>
            <div className="mt-3 space-y-3">
              {backers.map(([rel, items]) => (
                <div key={rel}>
                  <p className="text-[12.5px] font-medium text-muted">{REL_LABEL[rel as keyof typeof REL_LABEL]}</p>
                  <ul className="mt-1 space-y-1 text-[14px]">
                    {items.map((b) => (
                      <li key={b.name}>
                        <span className="font-medium">{b.name}</span>
                        {b.detail && <span className="text-muted"> — {b.detail}</span>}
                        <Cite ids={b.sources} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </Section>
  );
}

/* ================= Financial health ================= */

const PROFIT = {
  profitable: { label: "Confirmed profitable", tone: "bull" },
  not_profitable: { label: "Confirmed not yet profitable", tone: "bear" },
  not_disclosed: { label: "Not publicly disclosed", tone: "neutral" },
} as const;

export function FinancialsSection({ r }: { r: Report }) {
  const f = r.financials;
  const p = PROFIT[f.profitability.status];
  const runwayLabel = f.runway.status === "not_disclosed" ? "Not publicly disclosed" : f.runway.value;
  return (
    <Section
      id="financials"
      eyebrow="05 · Financial health"
      title="Money in, money out"
      summary="Private companies disclose little. Unknowns are shown as unknowns — no scores, no guessed runway."
    >
      <Card className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3">
        <div className="space-y-5 p-5">
          <Stat label="Revenue / ARR" claim={f.revenue} />
          <Stat label="Growth" claim={f.revenueGrowth} />
        </div>
        <div className="space-y-5 p-5">
          <div>
            <Label>Profitability</Label>
            <div className="mt-2">
              <Tag tone={p.tone}>{p.label}</Tag>
            </div>
            {f.profitability.detail && (
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">
                {f.profitability.detail}
                <Cite ids={f.profitability.sources} />
              </p>
            )}
          </div>
          <Stat label="Gross margin" claim={f.grossMargin} />
        </div>
        <div className="space-y-5 p-5 sm:col-span-2 sm:border-t sm:border-line lg:col-span-1 lg:border-t-0">
          <Stat label="Burn / cash flow" claim={f.burn} />
          <div>
            <Label>Runway</Label>
            <p className={`mt-1.5 text-[14px] ${f.runway.status === "not_disclosed" ? "text-faint" : ""}`}>
              {f.runway.status === "estimated" && <Tag tone="warn">Estimate</Tag>} {runwayLabel}
              <Cite ids={f.runway.sources} />
            </p>
            {f.runway.assumptions && <p className="mt-1 text-[13px] leading-relaxed text-muted">{f.runway.assumptions}</p>}
            {f.runway.neededInfo.length > 0 && (
              <p className="mt-1 text-[13px] leading-relaxed text-muted">To assess it we&apos;d need: {f.runway.neededInfo.join("; ")}.</p>
            )}
          </div>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card className="p-5">
          <Label>Business model</Label>
          <p className="mt-2 text-[14px] leading-relaxed">
            <ClaimText claim={f.businessModel} />
          </p>
          {f.revenueStreams.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-[13.5px] text-ink-2">
              {f.revenueStreams.map((c, i) => (
                <li key={i}>
                  <ClaimText claim={c} />
                </li>
              ))}
            </ul>
          )}
          {f.commercialRelationships.length > 0 && (
            <>
              <div className="mt-4">
                <Label>Commercial relationships</Label>
              </div>
              <ul className="mt-2 space-y-1.5 text-[13.5px]">
                {f.commercialRelationships.map((c, i) => (
                  <li key={i}>
                    <ClaimText claim={c} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
        <Card className="p-5">
          <Label>Financial health assessment</Label>
          <div className="mt-3 grid gap-5 sm:grid-cols-2">
            <ClaimList title="Known facts" items={f.assessment.facts} />
            <ClaimList title="Potential strengths" items={f.assessment.strengths} tone="bull" />
            <ClaimList title="Risks" items={f.assessment.risks} tone="bear" />
            {f.assessment.questions.length > 0 && (
              <div>
                <p className="mb-2 text-[13px] font-semibold">Unanswered questions</p>
                <ul className="list-disc space-y-1.5 pl-4 text-[14px] leading-relaxed text-ink-2">
                  {f.assessment.questions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      </div>
    </Section>
  );
}

/* ================= Hiring ================= */

export function HiringSection({ r }: { r: Report }) {
  const h = r.hiring;
  const [dept, setDept] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const byDept = useMemo(() => countBy(h.roles.map((x) => x.department)), [h.roles]);
  const modes = useMemo(() => countBy(h.roles.map((x) => x.workMode || "Not stated")), [h.roles]);
  const roles = dept ? h.roles.filter((x) => (x.department || "Other") === dept) : h.roles;
  const visible = showAll ? roles : roles.slice(0, 8);
  const salaried = h.roles.filter((x) => x.salary).length;

  return (
    <Section
      id="hiring"
      eyebrow="06 · Hiring"
      title="What they're hiring for"
      summary={
        <>
          <span className="font-serif text-[1.65rem] leading-none">
            {h.totalOpenings == null ? "Not available" : `${h.totalOpenings} open role${h.totalOpenings === 1 ? "" : "s"}`}
          </span>
          <span className="mt-1.5 block text-[13px] text-muted">
            {h.sourceUrl ? <ExternalLink href={h.sourceUrl}>{h.sourceLabel}</ExternalLink> : h.sourceLabel}
            {h.checkedAt && ` · checked ${formatDate(h.checkedAt)}`}
            {h.method === "job-board-api" && " · exact count"}
          </span>
        </>
      }
    >
      {h.roles.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
          <Card className="p-5">
            <Label>By department · click to filter</Label>
            <div className="mt-3">
              <HBars items={byDept} active={dept} onSelect={setDept} />
            </div>
            <div className="mt-5 flex flex-wrap gap-1.5">
              {modes.map((m) => (
                <Tag key={m.label}>
                  {m.label} · {m.value}
                </Tag>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              {salaried ? `${salaried} of ${h.roles.length} postings list a salary range.` : "No postings list salary ranges."}
            </p>
          </Card>
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <Label>{dept ? `${dept} · ${roles.length}` : `All roles · ${roles.length}`}</Label>
              {dept && (
                <button type="button" onClick={() => setDept(null)} className="text-[12.5px] font-medium text-accent hover:text-ink">
                  Clear filter
                </button>
              )}
            </div>
            <ul className="divide-y divide-line">
              {visible.map((role, i) => (
                <li key={role.url + i}>
                  <a
                    href={role.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col gap-0.5 px-5 py-3 transition hover:bg-paper sm:flex-row sm:items-center sm:gap-4"
                  >
                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{role.title}</span>
                    <span className="shrink-0 text-[12.5px] text-muted sm:max-w-[45%] sm:truncate sm:text-right">
                      {[role.location, role.workMode, role.salary].filter(Boolean).join(" · ")}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            {roles.length > 8 && (
              <button
                type="button"
                onClick={() => setShowAll((s) => !s)}
                className="w-full border-t border-line px-5 py-3 text-left text-[13px] font-medium text-accent hover:bg-paper"
              >
                {showAll ? "Show fewer" : `Show all ${roles.length} roles`}
              </button>
            )}
          </Card>
        </div>
      ) : (
        <Card className="p-5 text-[14px] text-muted">{h.note || "No currently advertised openings could be found."}</Card>
      )}
      {h.interpretation.length > 0 && <Signals title="What the hiring mix may suggest" points={h.interpretation} />}
    </Section>
  );
}

/* ================= Market ================= */

export function MarketSection({ r }: { r: Report }) {
  const b = r.business;
  return (
    <Section id="market" eyebrow="07 · Business & competition" title="What it does, and against whom" summary={<ClaimText claim={b.product} />}>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Customers", b.customers],
          ["Business model", b.businessModel],
          ["Distribution", b.distribution],
        ].map(([label, c]) => (
          <Card key={label as string} className="p-5">
            <Label>{label as string}</Label>
            <p className="mt-2 text-[14px] leading-relaxed">
              <ClaimText claim={c as Claim} />
            </p>
          </Card>
        ))}
      </div>

      {b.competitors.length > 0 && (
        <Card className="mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[14px]">
              <thead>
                <tr className="border-b border-line bg-paper/60">
                  <th className="px-5 py-2.5 font-mono text-[10.5px] font-normal uppercase tracking-[0.12em] text-faint">Competitor</th>
                  <th className="px-5 py-2.5 font-mono text-[10.5px] font-normal uppercase tracking-[0.12em] text-faint">Positioning</th>
                  <th className="px-5 py-2.5 font-mono text-[10.5px] font-normal uppercase tracking-[0.12em] text-faint">
                    How {r.company.name || "it"} differs
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {b.competitors.map((c) => (
                  <tr key={c.name} className="align-top">
                    <td className="px-5 py-3 font-medium">
                      <ExternalLink href={c.website}>{c.name}</ExternalLink>
                    </td>
                    <td className="px-5 py-3 text-ink-2">{c.positioning}</td>
                    <td className="px-5 py-3 text-ink-2">
                      {c.difference}
                      <Cite ids={c.sources} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {b.differentiation.length > 0 && (
          <Card className="p-5">
            <ClaimList title="Differentiation" items={b.differentiation} />
          </Card>
        )}
        {b.trends.length > 0 && (
          <Card className="p-5">
            <ClaimList title="Market trends" items={b.trends} />
          </Card>
        )}
      </div>
    </Section>
  );
}

/* ================= Bull vs Bear ================= */

function CaseColumn({ title, points, tone }: { title: string; points: Point[]; tone: "bull" | "bear" }) {
  return (
    <div className={`rounded-2xl p-5 sm:p-6 ${tone === "bull" ? "bg-bull-soft" : "bg-bear-soft"}`}>
      <p className={`font-serif text-[1.75rem] ${tone === "bull" ? "text-bull" : "text-bear"}`}>{title}</p>
      {points.length ? (
        <ol className="mt-4 space-y-4">
          {points.map((p, i) => (
            <li key={i} className="grid grid-cols-[22px_1fr] gap-2">
              <span className={`tabular pt-0.5 font-mono text-[12px] ${tone === "bull" ? "text-bull" : "text-bear"}`}>{String(i + 1).padStart(2, "0")}</span>
              <div>
                <p className="text-[15px] font-semibold leading-snug">
                  {p.title}
                  <span className={`ml-2 align-middle text-[11px] font-medium ${p.status === "verified" ? "text-verified" : "text-inferred"}`}>
                    {p.status === "verified" ? "Evidence" : "Hypothesis"}
                  </span>
                </p>
                <p className="mt-1 text-[14px] leading-relaxed text-ink-2">
                  {p.detail}
                  <Cite ids={p.sources} />
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-[14px] text-muted">Not enough evidence to make this case.</p>
      )}
    </div>
  );
}

export function InvestorCaseSection({ r }: { r: Report }) {
  const c = r.investorCase;
  return (
    <Section
      id="verdict"
      eyebrow="08 · Investor perspective"
      title="Bull vs. bear"
      summary="Each point is marked as resting on evidence or as an analytical hypothesis. Negatives aren't invented to balance positives."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <CaseColumn title="The bull case" points={c.bull} tone="bull" />
        <CaseColumn title="The bear case" points={c.bear} tone="bear" />
      </div>

      <Card className="mt-4 grid gap-6 p-5 sm:p-6 lg:grid-cols-2">
        <ClaimList title="Three strongest positives" items={c.topPositives} tone="bull" />
        <ClaimList title="Three biggest concerns or open questions" items={c.topConcerns} tone="bear" />
        {c.mustBeTrue.length > 0 && (
          <div>
            <p className="mb-2 text-[13px] font-semibold">What would need to be true</p>
            <ul className="list-disc space-y-1.5 pl-4 text-[14px] leading-relaxed text-ink-2">
              {c.mustBeTrue.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}
        {c.diligenceQuestions.length > 0 && (
          <div>
            <p className="mb-2 text-[13px] font-semibold">Five diligence questions to ask</p>
            <ol className="list-decimal space-y-1.5 pl-4 text-[14px] leading-relaxed text-ink-2">
              {c.diligenceQuestions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
          </div>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted">{c.disclaimer || "This is a research summary from public sources, not investment advice."}</p>
    </Section>
  );
}

/* ================= News ================= */

const KIND_TONE = { funding: "accent", acquisition: "bull", leadership: "warn", regulatory: "bear" } as const;

export function NewsSection({ r }: { r: Report }) {
  const items = [...r.news].sort((a, b) => b.date.localeCompare(a.date));
  if (!items.length) return null;
  return (
    <Section id="news" eyebrow="09 · Recent developments" title="What's been happening">
      <ol className="relative ml-1.5 border-l border-line">
        {items.map((n, i) => (
          <li key={i} className="relative pb-6 pl-6 last:pb-0">
            <span className="absolute top-1.5 -left-[4.5px] h-2 w-2 rounded-full border border-card bg-accent" />
            <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
              <span className="tabular">{formatDate(n.date)}</span>
              {n.eventDate && n.eventDate !== n.date && <span>· event {formatDate(n.eventDate)}</span>}
              <Tag tone={KIND_TONE[n.kind as keyof typeof KIND_TONE] ?? "neutral"}>{n.kind}</Tag>
            </div>
            <p className="mt-1 text-[15px] font-medium">
              {n.title}
              <Cite ids={n.sources} />
            </p>
            {n.summary && <p className="text-[14px] leading-relaxed text-ink-2">{n.summary}</p>}
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* ================= Sources ================= */

export function SourcesSection({ r }: { r: Report }) {
  return (
    <Section
      id="sources"
      eyebrow="10 · Sources"
      title="Where this comes from"
      summary={`${r.sources.length} sources. Every citation links to a page retrieved during research.`}
    >
      <Disclosure label={`Show all ${r.sources.length} sources`}>
        <ol className="grid gap-x-8 gap-y-2 text-[13.5px] md:grid-cols-2">
          {r.sources.map((s, i) => (
            <li key={s.id} className="grid grid-cols-[28px_1fr] gap-1">
              <span className="tabular font-mono text-[12px] text-faint">{i + 1}</span>
              <span className="min-w-0">
                <ExternalLink href={s.url}>{s.title}</ExternalLink>
                <span className="block truncate text-xs text-muted">
                  {s.publisher || hostOf(s.url)}
                  {s.date && ` · ${formatDate(s.date)}`}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </Disclosure>
      {r.notes.length > 0 && (
        <ul className="mt-6 space-y-1 text-[13px] text-muted">
          {r.notes.map((n) => (
            <li key={n}>· {n}</li>
          ))}
        </ul>
      )}
    </Section>
  );
}
