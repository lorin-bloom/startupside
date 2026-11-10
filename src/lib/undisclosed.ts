import type { Claim, Report } from "./schema";

/**
 * Reports leave out anything that isn't publicly known instead of printing
 * "Not disclosed" everywhere; a single caveat line lists what's missing.
 */

const EMPTY = /^(not (publicly )?(disclosed|available|established|known|reported)|undisclosed|unknown|n\/a|none)\b/i;
/** e.g. "Profitability not disclosed", "Runway undisclosed": a headline that says nothing else. */
const ONLY_UNDISCLOSED = /^[\w/&-]+(\s[\w/&-]+){0,2}\s(is\s|are\s)?(not (publicly )?(disclosed|available|known)|undisclosed)\.?$/i;

export function isEmptyText(t: string | undefined | null): boolean {
  const s = (t ?? "").trim();
  return !s || s === "—" || s === "-" || EMPTY.test(s);
}

/** A single fact worth showing: has real text and isn't marked unknown. */
export function hasClaim(c: Claim): boolean {
  return !isEmptyText(c.text) && c.status !== "unknown";
}

/** Short headline text that is really just "we don't know". */
export function isUndisclosedHeadline(t: string): boolean {
  return isEmptyText(t) || ONLY_UNDISCLOSED.test(t.trim());
}

/** Labels for the one "Not publicly disclosed: …" caveat. */
export function undisclosedItems(r: Report): string[] {
  const f = r.financials;
  const t = r.team;
  const items: [boolean, string][] = [
    [!hasClaim(r.funding.total) && r.funding.rounds.length === 0, "funding"],
    [!hasClaim(r.funding.valuation), "valuation"],
    [!hasClaim(f.revenue), "revenue"],
    [!hasClaim(f.revenueGrowth), "revenue growth"],
    [f.profitability.status === "not_disclosed", "profitability"],
    [!hasClaim(f.grossMargin), "gross margin"],
    [!hasClaim(f.burn), "burn rate"],
    [f.runway.status === "not_disclosed", "runway"],
    [!hasClaim(t.employeeCount) && t.headcountEstimates.length === 0, "headcount"],
    [!hasClaim(t.growth6m) && !hasClaim(t.growth12m) && t.headcountHistory.length < 2, "headcount growth"],
    [!hasClaim(t.tenure), "employee tenure"],
    [!hasClaim(t.turnover), "turnover"],
    [r.funding.board.length === 0, "board members"],
    [r.hiring.totalOpenings == null && r.hiring.roles.length === 0, "open roles"],
  ];
  return items.filter(([missing]) => missing).map(([, label]) => label);
}
