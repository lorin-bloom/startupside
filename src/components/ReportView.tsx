"use client";

import Link from "next/link";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import type { Report, Status } from "@/lib/schema";
import { AskPanel } from "./AskPanel";
import { money } from "./charts";
import {
  FinancialsSection,
  FoundersSection,
  HiringSection,
  InvestorCaseSection,
  InvestorsSection,
  MarketSection,
  NewsSection,
  SourcesSection,
  TeamSection,
  countBy,
} from "./sections";
import { Cite, ClaimText, Label, SourcesContext, StatusDot, StatusLegend, Tag, buildSourceIndex, formatDate, hostOf, isEmptyText } from "./ui";
import { SearchBox } from "./SearchBox";

type CardKey = "funding" | "team" | "founders" | "financial" | "hiring" | "investorView";

const NAV = [
  ["overview", "Overview"],
  ["founders", "Founders"],
  ["team", "Team"],
  ["investors", "Investors"],
  ["financials", "Financials"],
  ["hiring", "Hiring"],
  ["market", "Market"],
  ["verdict", "Bull vs. bear"],
  ["news", "News"],
  ["sources", "Sources"],
] as const;

function Logo({ r }: { r: Report }) {
  const [failed, setFailed] = useState(false);
  const name = r.company.name || r.company.domain;
  if (!r.company.logoUrl || failed)
    return (
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-line bg-card font-serif text-2xl text-accent">
        {name[0]?.toUpperCase()}
      </span>
    );
  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-card p-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary third-party favicons */}
      <img src={r.company.logoUrl} alt="" className="h-full w-full object-contain" onError={() => setFailed(true)} referrerPolicy="no-referrer" />
    </span>
  );
}

function SnapshotCard({
  label,
  headline,
  detail,
  status,
  sources,
  open,
  onToggle,
}: {
  label: string;
  headline: string;
  detail: ReactNode;
  status: Status;
  sources: string[];
  open: boolean;
  onToggle: () => void;
}) {
  const empty = isEmptyText(headline);
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={`group flex h-full flex-col rounded-2xl border bg-card p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_24px_-12px_rgba(22,21,15,0.25)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:p-5 ${
        open ? "border-accent shadow-[0_6px_24px_-12px_rgba(47,93,80,0.45)]" : "border-line"
      }`}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <Label>{label}</Label>
        <StatusDot status={empty ? "unknown" : status} />
      </div>
      <p className={`mt-3 font-serif text-[1.45rem] leading-[1.1] tracking-[-0.005em] sm:text-[1.6rem] ${empty ? "text-faint" : ""}`}>
        {empty ? "Not disclosed" : headline}
      </p>
      <p className="mt-2 text-[13.5px] leading-snug text-muted">
        {detail}
        <Cite ids={sources} />
      </p>
      <span className="mt-auto flex items-center gap-1 pt-3 text-[12.5px] font-medium text-accent opacity-80 group-hover:opacity-100">
        {open ? "Less" : "More"}
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className={`transition-transform ${open ? "-rotate-90" : "rotate-90"}`}>
          <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}

function Expanded({ k, r }: { k: CardKey; r: Report }) {
  const go = (id: string, label: string) => (
    <a href={`#${id}`} className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:text-ink">
      {label} ↓
    </a>
  );
  const body: Record<CardKey, ReactNode> = {
    funding: (
      <>
        <ul className="grid gap-x-8 gap-y-2 text-[14px] sm:grid-cols-2">
          {[...r.funding.rounds]
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 4)
            .map((x) => (
              <li key={x.name + x.date} className="flex justify-between gap-4 border-b border-line pb-2">
                <span>
                  <span className="font-medium">{x.name}</span> <span className="text-muted">· {formatDate(x.date)}</span>
                  {x.leads.length > 0 && <span className="block text-[12.5px] text-muted">Led by {x.leads.slice(0, 3).join(", ")}</span>}
                </span>
                <span className="tabular shrink-0">{x.amountLabel || money(x.amountUsd)}</span>
              </li>
            ))}
        </ul>
        {go("investors", "All rounds, investors and board")}
      </>
    ),
    team: (
      <>
        <div className="grid gap-3 text-[14px] sm:grid-cols-3">
          <ClaimText claim={r.team.employeeCount} />
          <span>
            12-mo growth: <ClaimText claim={r.team.growth12m} />
          </span>
          <span className="text-muted">{r.team.locations.map((l) => l.name).slice(0, 4).join(" · ")}</span>
        </div>
        {go("team", "Team intelligence")}
      </>
    ),
    founders: (
      <>
        <ul className="grid gap-3 text-[14px] sm:grid-cols-3">
          {r.founders.people.map((f) => (
            <li key={f.name}>
              <span className="font-medium">{f.name}</span> <span className="text-muted">· {f.title}</span>
              <span className="block text-[13px] text-ink-2">{f.summary}</span>
            </li>
          ))}
        </ul>
        {go("founders", "Founder profiles and assessment")}
      </>
    ),
    financial: (
      <>
        <div className="grid gap-3 text-[14px] sm:grid-cols-3">
          <span>
            <span className="block text-xs text-muted">Revenue</span>
            <ClaimText claim={r.financials.revenue} />
          </span>
          <span>
            <span className="block text-xs text-muted">Profitability</span>
            {r.financials.profitability.status === "profitable"
              ? "Confirmed profitable"
              : r.financials.profitability.status === "not_profitable"
                ? "Confirmed not yet profitable"
                : "Not publicly disclosed"}
          </span>
          <span>
            <span className="block text-xs text-muted">Runway</span>
            {r.financials.runway.status === "not_disclosed" ? "Not publicly disclosed" : r.financials.runway.value}
          </span>
        </div>
        {go("financials", "Financial health")}
      </>
    ),
    hiring: (
      <>
        <div className="flex flex-wrap gap-1.5">
          {countBy(r.hiring.roles.map((x) => x.department))
            .slice(0, 6)
            .map((d) => (
              <Tag key={d.label}>
                {d.label} · {d.value}
              </Tag>
            ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          {r.hiring.sourceLabel}
          {r.hiring.checkedAt && ` · checked ${formatDate(r.hiring.checkedAt)}`}
        </p>
        {go("hiring", "All open roles")}
      </>
    ),
    investorView: (
      <>
        <div className="grid gap-5 text-[14px] sm:grid-cols-2">
          <ul className="space-y-1.5">
            <li className="text-[13px] font-semibold text-bull">Strongest positives</li>
            {r.investorCase.topPositives.map((c, i) => (
              <li key={i}>
                <ClaimText claim={c} />
              </li>
            ))}
          </ul>
          <ul className="space-y-1.5">
            <li className="text-[13px] font-semibold text-bear">Biggest concerns</li>
            {r.investorCase.topConcerns.map((c, i) => (
              <li key={i}>
                <ClaimText claim={c} />
              </li>
            ))}
          </ul>
        </div>
        {go("verdict", "Full bull vs. bear analysis")}
      </>
    ),
  };
  return <div className="rise rounded-2xl border border-line bg-card p-5 sm:p-6">{body[k]}</div>;
}

export function ReportView({ report: r, onRefresh }: { report: Report; onRefresh?: () => void }) {
  const index = useMemo(() => buildSourceIndex(r.sources), [r.sources]);
  const [open, setOpen] = useState<CardKey | null>(null);
  const s = r.snapshot;
  const toggle = (k: CardKey) => setOpen((o) => (o === k ? null : k));
  const facts = [r.company.industry, r.company.headquarters, r.company.founded && `Founded ${r.company.founded}`, r.company.stage].filter(
    (x) => x && !isEmptyText(x),
  );

  const cards: { k: CardKey; label: string; headline: string; detail: ReactNode; status: Status; sources: string[] }[] = [
    { k: "funding", label: "Funding", ...s.funding },
    { k: "team", label: "Team", ...s.team },
    { k: "founders", label: "Founders", ...s.founders },
    { k: "financial", label: "Financial health", ...s.financial },
    { k: "hiring", label: "Hiring", ...s.hiring },
    {
      k: "investorView",
      label: "Investor view",
      headline: s.investorView.upside ? "Upside vs. concern" : "",
      detail: (
        <>
          <span className="block text-ink-2">
            <span className="text-bull">↑</span> {s.investorView.upside}
          </span>
          <span className="mt-1 block text-ink-2">
            <span className="text-bear">↓</span> {s.investorView.concern}
          </span>
        </>
      ),
      status: s.investorView.status,
      sources: s.investorView.sources,
    },
  ];
  const openIdx = open ? cards.findIndex((c) => c.k === open) : -1;

  return (
    <SourcesContext.Provider value={index}>
      <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="shrink-0 font-serif text-[1.35rem] leading-none tracking-tight">
            Startup<span className="italic text-accent">side</span>
          </Link>
          <nav aria-label="Report sections" className="hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto lg:flex">
            {NAV.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] text-muted transition hover:bg-card hover:text-ink">
                {label}
              </a>
            ))}
          </nav>
          <div className="ml-auto w-full max-w-[220px] lg:max-w-[200px]">
            <SearchBox compact />
          </div>
        </div>
        <nav aria-label="Report sections" className="flex gap-0.5 overflow-x-auto px-3 pb-2 lg:hidden">
          {NAV.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="whitespace-nowrap rounded-full px-2.5 py-1 text-[12.5px] text-muted hover:bg-card hover:text-ink">
              {label}
            </a>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-32 sm:px-6">
        <section id="overview" className="rise scroll-mt-28 pt-8 sm:pt-12">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 gap-4">
              <Logo r={r} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-serif text-[2.6rem] leading-none tracking-[-0.015em] sm:text-[3.4rem]">{r.company.name || r.company.domain}</h1>
                  {r.mode === "sample" && <Tag tone="accent">Sample report</Tag>}
                </div>
                <p className="mt-2 text-[15px] text-ink-2">
                  {r.company.tagline || r.company.description}
                  <Cite ids={r.company.sources} />
                </p>
                <p className="mt-1.5 text-[13px] text-muted">
                  <a href={r.company.website || `https://${r.company.domain}`} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    {hostOf(r.company.website || `https://${r.company.domain}`)} ↗
                  </a>
                  {facts.length > 0 && <span> · {facts.join(" · ")}</span>}
                </p>
              </div>
            </div>
            <div className="shrink-0 space-y-1.5 text-[12.5px] text-muted lg:text-right">
              <p>
                Researched {formatDate(r.researchedAt.slice(0, 10))} · {r.sources.length} sources
                {onRefresh && r.mode === "live" && (
                  <>
                    {" · "}
                    <button type="button" onClick={onRefresh} className="text-accent hover:underline">
                      Refresh
                    </button>
                  </>
                )}
              </p>
              <StatusLegend />
            </div>
          </div>

          {r.company.description && r.company.tagline && (
            <p className="mt-6 max-w-3xl text-[16px] leading-relaxed text-ink-2">{r.company.description}</p>
          )}

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c, i) => {
              // Small screens: the detail panel opens right under the clicked card.
              // Large screens (3 columns): it opens under the clicked card's row.
              const rowEnd = Math.min(cards.length - 1, Math.floor(openIdx / 3) * 3 + 2);
              return (
                <Fragment key={c.k}>
                  <div className="rise h-full" style={{ animationDelay: `${i * 40}ms` }}>
                    <SnapshotCard {...c} open={open === c.k} onToggle={() => toggle(c.k)} />
                  </div>
                  {open && i === openIdx && (
                    <div className="col-span-full lg:hidden">
                      <Expanded k={open} r={r} />
                    </div>
                  )}
                  {open && i === rowEnd && (
                    <div className="col-span-full hidden lg:block">
                      <Expanded k={open} r={r} />
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>

          {r.notes.length > 0 && <p className="mt-4 text-[13px] text-muted">Note: {r.notes[0]}</p>}
        </section>

        <FoundersSection r={r} />
        <TeamSection r={r} />
        <InvestorsSection r={r} />
        <FinancialsSection r={r} />
        <HiringSection r={r} />
        <MarketSection r={r} />
        <InvestorCaseSection r={r} />
        <NewsSection r={r} />
        <SourcesSection r={r} />

        <footer className="mt-16 border-t border-line pt-6 text-[12.5px] leading-relaxed text-muted">
          Startupside compiles public information with AI assistance and links every claim to its source. It can be incomplete or
          out of date, and it isn&apos;t investment, legal or career advice. Paid databases (Crunchbase, PitchBook, LinkedIn Premium) are not
          accessed.
        </footer>
      </main>

      <AskPanel report={r} />
    </SourcesContext.Provider>
  );
}
