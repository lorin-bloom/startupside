"use client";

import { formatDate } from "./ui";

export function money(n: number | null | undefined): string {
  if (n == null) return "Undisclosed";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(n >= 1e10 ? 0 : 2).replace(/\.?0+$/, "")}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1).replace(/\.0$/, "")}M`;
  return `$${Math.round(n / 1e3)}K`;
}

type Round = { name: string; date: string; amountUsd: number | null; amountLabel: string };

/** Funding rounds over time. Click a bar to select it. Undisclosed amounts show as outlined stubs. */
export function FundingBars({ rounds, selected, onSelect }: { rounds: Round[]; selected: number; onSelect: (i: number) => void }) {
  const ordered = rounds.map((r, i) => ({ ...r, i })).sort((a, b) => a.date.localeCompare(b.date));
  const max = Math.max(1, ...ordered.map((r) => r.amountUsd ?? 0));
  return (
    <div role="group" aria-label="Funding rounds by date" className="flex h-44 items-end gap-1.5 sm:gap-2.5">
      {ordered.map((r, k) => {
        const h = r.amountUsd ? Math.max(4, (r.amountUsd / max) * 100) : 8;
        const active = r.i === selected;
        return (
          <button
            key={r.i}
            type="button"
            onClick={() => onSelect(r.i)}
            aria-pressed={active}
            aria-label={`${r.name}, ${formatDate(r.date)}, ${r.amountLabel || money(r.amountUsd)}`}
            className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5 focus-visible:outline-none"
          >
            <span className={`tabular text-[10.5px] leading-none transition-colors ${active ? "text-ink" : "text-faint group-hover:text-ink"}`}>
              {r.amountUsd ? money(r.amountUsd) : "—"}
            </span>
            <span
              style={{ height: `${h}%`, animationDelay: `${k * 50}ms` }}
              className={`grow-y w-full max-w-12 rounded-t-[5px] transition-colors group-focus-visible:ring-2 group-focus-visible:ring-accent ${
                r.amountUsd
                  ? active
                    ? "bg-accent"
                    : "bg-accent/35 group-hover:bg-accent/60"
                  : `border border-dashed ${active ? "border-accent" : "border-line-2"} bg-transparent`
              }`}
            />
            <span className={`w-full truncate text-center font-mono text-[9.5px] ${active ? "text-ink" : "text-faint"}`}>
              {r.date.slice(0, 4)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Horizontal bars for categorical counts; optionally clickable to filter. */
export function HBars({
  items,
  active,
  onSelect,
  unit = "",
}: {
  items: { label: string; value: number }[];
  active?: string | null;
  onSelect?: (label: string | null) => void;
  unit?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-1">
      {items.map((it, k) => {
        const on = active === it.label;
        const dim = active && !on;
        const inner = (
          <>
            <span className={`w-32 shrink-0 truncate text-left text-[13px] sm:w-40 ${dim ? "text-faint" : "text-ink-2"}`}>{it.label}</span>
            <span className="relative h-5 flex-1">
              <span
                style={{ width: `${(it.value / max) * 100}%`, animationDelay: `${k * 40}ms` }}
                className={`grow-x absolute inset-y-0 left-0 rounded-[4px] transition-colors ${on ? "bg-accent" : dim ? "bg-line" : "bg-accent/30"}`}
              />
            </span>
            <span className="tabular w-10 shrink-0 text-right text-[13px] text-ink">
              {it.value}
              {unit}
            </span>
          </>
        );
        return (
          <li key={it.label}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(on ? null : it.label)}
                aria-pressed={on}
                className="flex w-full items-center gap-3 rounded-md px-1 py-0.5 hover:bg-paper focus-visible:outline-2 focus-visible:outline-accent"
              >
                {inner}
              </button>
            ) : (
              <div className="flex items-center gap-3 px-1 py-0.5">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Small line chart for dated headcount points. Needs at least two points. */
export function HeadcountLine({ points }: { points: { date: string; count: number }[] }) {
  const pts = [...points].sort((a, b) => a.date.localeCompare(b.date));
  if (pts.length < 2) return null;
  const W = 320;
  const H = 120;
  const pad = { l: 8, r: 8, t: 22, b: 22 };
  const t = (d: string) => new Date(d.length === 7 ? `${d}-01` : d).getTime();
  const t0 = t(pts[0].date);
  const t1 = t(pts[pts.length - 1].date);
  const maxV = Math.max(...pts.map((p) => p.count)) * 1.1;
  const x = (d: string) => pad.l + ((t(d) - t0) / Math.max(1, t1 - t0)) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - (v / maxV) * (H - pad.t - pad.b);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.count).toFixed(1)}`).join(" ");
  // Date labels: always first and last; middle ones only where they won't collide.
  const showDate = new Set<number>([0, pts.length - 1]);
  let lastX = x(pts[0].date);
  pts.forEach((p, i) => {
    if (i === 0 || i === pts.length - 1) return;
    if (x(p.date) - lastX >= 70 && x(pts[pts.length - 1].date) - x(p.date) >= 70) {
      showDate.add(i);
      lastX = x(p.date);
    }
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Headcount: ${pts.map((p) => `${p.count} in ${formatDate(p.date)}`).join(", ")}`}>
      <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="var(--line)" />
      <path d={`${path} L${x(pts[pts.length - 1].date)},${H - pad.b} L${x(pts[0].date)},${H - pad.b} Z`} fill="var(--accent-soft)" />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <g key={p.date}>
          <circle cx={x(p.date)} cy={y(p.count)} r="3.5" fill="var(--card)" stroke="var(--accent)" strokeWidth="2" />
          <text x={x(p.date)} y={y(p.count) - 9} textAnchor={i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"} fontSize="11" fill="var(--ink)" className="tabular">
            {p.count.toLocaleString()}
          </text>
          {showDate.has(i) && (
            <text x={x(p.date)} y={H - 6} textAnchor={i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"} fontSize="10" fill="var(--faint)">
              {formatDate(p.date)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
