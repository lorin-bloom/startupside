"use client";

import { createContext, useContext, useId, useState, type ReactNode } from "react";
import type { Claim, Source, Status } from "@/lib/schema";

/* ---------- Sources & citations ---------- */

type SourceIndex = Map<string, { n: number; source: Source }>;
export const SourcesContext = createContext<SourceIndex>(new Map());

export function buildSourceIndex(sources: Source[]): SourceIndex {
  return new Map(sources.map((s, i) => [s.id, { n: i + 1, source: s }]));
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Superscript citation chips; hover/focus shows the source, click opens it. */
export function Cite({ ids }: { ids: string[] }) {
  const index = useContext(SourcesContext);
  const items = ids.map((id) => index.get(id)).filter(Boolean) as { n: number; source: Source }[];
  if (!items.length) return null;
  return (
    <span className="ml-0.5 inline-flex gap-0.5 align-super">
      {items.slice(0, 4).map(({ n, source }) => (
        <a
          key={source.id}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative inline-flex h-[15px] min-w-[15px] items-center justify-center rounded-[4px] bg-line/70 px-[3px] font-mono text-[9.5px] leading-none text-muted no-underline transition hover:bg-accent hover:text-white focus-visible:bg-accent focus-visible:text-white focus-visible:outline-none"
          aria-label={`Source ${n}: ${source.title}`}
        >
          {n}
          <span className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-30 hidden w-64 -translate-x-1/2 rounded-lg border border-line bg-card p-2.5 text-left font-sans text-xs leading-snug text-ink shadow-lg group-hover:block group-focus-visible:block">
            <span className="block font-medium">{source.title}</span>
            <span className="mt-1 block text-muted">
              {source.publisher || hostOf(source.url)}
              {source.date ? ` · ${source.date}` : ""}
            </span>
          </span>
        </a>
      ))}
    </span>
  );
}

/* ---------- Evidence status ---------- */

const STATUS_META: Record<Status, { label: string; color: string; help: string }> = {
  verified: { label: "Verified", color: "bg-verified", help: "Supported by a retrieved source" },
  inferred: { label: "Inferred", color: "bg-inferred", help: "A reasoned interpretation of the evidence" },
  unknown: { label: "Unknown", color: "bg-unknown", help: "Not reliably established from public sources" },
};

export function StatusDot({ status, className = "" }: { status: Status; className?: string }) {
  const m = STATUS_META[status];
  return (
    <span
      title={`${m.label}: ${m.help}`}
      aria-label={m.label}
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${m.color} ${className}`}
    />
  );
}

export function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      {(Object.keys(STATUS_META) as Status[]).map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5" title={STATUS_META[s].help}>
          <StatusDot status={s} />
          {STATUS_META[s].label}
        </span>
      ))}
    </div>
  );
}

export function isEmptyText(t: string | undefined | null) {
  return !t || /^(not disclosed|unknown|n\/a|none|—|-)\.?$/i.test(t.trim());
}

/** Renders a claim (or "Not disclosed") with its status dot and citations. */
export function ClaimText({ claim, fallback = "Not disclosed", className = "" }: { claim: Claim; fallback?: string; className?: string }) {
  const empty = isEmptyText(claim.text);
  return (
    <span className={className}>
      <StatusDot status={empty ? "unknown" : claim.status} className="mr-2 -translate-y-[2px]" />
      <span className={empty ? "text-faint" : ""}>{empty ? fallback : claim.text}</span>
      {!empty && <Cite ids={claim.sources} />}
    </span>
  );
}

/* ---------- Layout primitives ---------- */

export function Section({
  id,
  eyebrow,
  title,
  summary,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  summary?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="rise scroll-mt-20 border-t border-line pt-10 pb-4 sm:pt-14">
      <div className="mb-6 grid gap-2 sm:mb-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:items-end sm:gap-8">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">{eyebrow}</p>
          <h2 className="mt-1.5 font-serif text-[2rem] leading-[1.05] tracking-[-0.01em] sm:text-[2.5rem]">{title}</h2>
        </div>
        {summary && <div className="text-[15px] leading-relaxed text-ink-2 sm:pb-1.5">{summary}</div>}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-card ${className}`}>{children}</div>;
}

export function Label({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">{children}</p>;
}

export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "bull" | "bear" | "warn" }) {
  const tones = {
    neutral: "bg-paper text-ink-2 border-line",
    accent: "bg-accent-soft text-accent border-transparent",
    bull: "bg-bull-soft text-bull border-transparent",
    bear: "bg-bear-soft text-bear border-transparent",
    warn: "bg-[#fbf3e6] text-inferred border-transparent",
  };
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11.5px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** Progressive disclosure: content hidden behind a quiet toggle. */
export function Disclosure({
  label,
  children,
  defaultOpen = false,
}: {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="group inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-accent hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className={`transition-transform ${open ? "rotate-90" : ""}`}>
          <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {open ? "Hide" : label}
      </button>
      {open && (
        <div id={id} className="rise mt-4">
          {children}
        </div>
      )}
    </div>
  );
}

export function Initials({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-serif text-accent"
      aria-hidden
    >
      {initials || "?"}
    </span>
  );
}

export function ExternalLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  if (!href) return <>{children}</>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`underline decoration-line-2 underline-offset-[3px] hover:decoration-accent ${className}`}>
      {children}
    </a>
  );
}

export function formatDate(d: string) {
  if (!d) return "";
  const m = d.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!m) return d;
  const [, y, mo, da] = m;
  if (!mo) return y;
  const month = new Date(Number(y), Number(mo) - 1, 1).toLocaleString("en-US", { month: "short" });
  return da ? `${month} ${Number(da)}, ${y}` : `${month} ${y}`;
}
