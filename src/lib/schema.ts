import { z } from "zod";

/**
 * The report schema. Every field is lenient (`.catch`) so a partially
 * malformed AI response still renders, with missing data shown as unknown
 * instead of crashing the page or being invented.
 */

const str = z.string().catch("");

/** An object that falls back to its all-defaults shape instead of failing. */
function obj<S extends z.ZodRawShape>(shape: S) {
  const o = z.object(shape);
  return o.catch(() => o.parse({}));
}
const strArr = z.array(z.string()).catch([]);

export const STATUSES = ["verified", "inferred", "unknown"] as const;
export const Status = z.enum(STATUSES).catch("unknown");
export type Status = z.infer<typeof Status>;

/** A single statement with its evidence level and source ids. */
export const Claim = z
  .object({
    text: str,
    status: Status,
    sources: strArr,
  })
  .catch({ text: "", status: "unknown", sources: [] });
export type Claim = z.infer<typeof Claim>;

/** A titled point (bull/bear arguments, interpretations). */
export const Point = z
  .object({
    title: str,
    detail: str,
    status: Status,
    sources: strArr,
  })
  .catch({ title: "", detail: "", status: "unknown", sources: [] });
export type Point = z.infer<typeof Point>;

export const Source = obj({
  id: str,
  title: str,
  url: str,
  publisher: str,
  date: str,
});
export type Source = z.infer<typeof Source>;

const arr = <T extends z.ZodTypeAny>(item: T) => z.array(item).catch([]);

export const Founder = obj({
  name: str,
  title: str,
  linkedinUrl: str,
  photoUrl: str,
  founderType: z.enum(["repeat", "first-time", "unknown"]).catch("unknown"),
  summary: str,
  education: strArr,
  priorRoles: arr(obj({ org: str, role: str, years: str })),
  priorStartups: arr(
    obj({
      name: str,
      role: str,
      outcome: z.enum(["acquired", "shut down", "active", "public", "unknown"]).catch("unknown"),
      note: str,
      sources: strArr,
    }),
  ),
  expertise: str,
  achievements: strArr,
  cofounderHistory: str,
  quotes: arr(obj({ text: str, exact: z.boolean().catch(false), context: str, sources: strArr })),
  sources: strArr,
});
export type Founder = z.infer<typeof Founder>;

const Person = obj({ name: str, role: str, date: str, note: str, sources: strArr });
export type Person = z.infer<typeof Person>;

export const Report = obj({
  version: z.literal(1).catch(1),
  mode: z.enum(["live", "sample"]).catch("live"),
  researchedAt: str,
  company: obj({
    name: str,
    website: str,
    domain: str,
    logoUrl: str,
    tagline: str,
    description: str,
    industry: str,
    headquarters: str,
    founded: str,
    stage: str,
    linkedinUrl: str,
    sources: strArr,
  }),
  snapshot: obj({
    funding: obj({ headline: str, detail: str, status: Status, sources: strArr }),
    team: obj({ headline: str, detail: str, status: Status, sources: strArr }),
    founders: obj({ headline: str, detail: str, status: Status, sources: strArr }),
    financial: obj({ headline: str, detail: str, status: Status, sources: strArr }),
    hiring: obj({ headline: str, detail: str, status: Status, sources: strArr }),
    investorView: obj({ upside: str, concern: str, status: Status, sources: strArr }),
  }),
  founders: obj({
    people: arr(Founder),
    otherLeaders: arr(Person),
    assessment: obj({
      domainExpertise: Claim,
      entrepreneurialExperience: Claim,
      complementarity: Claim,
      strengths: arr(Claim),
      gaps: arr(Claim),
    }),
  }),
  team: obj({
    employeeCount: Claim,
    growth6m: Claim,
    growth12m: Claim,
    tenure: Claim,
    turnover: Claim,
    headcountHistory: arr(obj({ date: str, count: z.number().catch(0), sources: strArr })),
    /** Third-party or reported headcount figures, shown side by side because methods differ. */
    headcountEstimates: arr(obj({ value: str, date: str, method: str, sources: strArr })),
    departments: arr(obj({ name: str, share: str, sources: strArr })),
    locations: arr(obj({ name: str, note: str, sources: strArr })),
    leadershipHires: arr(Person),
    leadershipDepartures: arr(Person),
    interpretation: arr(Point),
  }),
  funding: obj({
    total: Claim,
    valuation: Claim,
    rounds: arr(
      obj({
        name: str,
        date: str,
        amountUsd: z.number().nullable().catch(null),
        amountLabel: str,
        valuationLabel: str,
        leads: strArr,
        participants: strArr,
        sources: strArr,
      }),
    ),
    investors: arr(
      obj({
        name: str,
        firm: str,
        kind: z.enum(["vc", "angel", "corporate", "accelerator", "other"]).catch("other"),
        isLead: z.boolean().catch(false),
        website: str,
        linkedinUrl: str,
        partner: str,
        notableInvestments: strArr,
        rationale: str,
        rationaleExact: z.boolean().catch(false),
        sources: strArr,
      }),
    ),
    board: arr(
      obj({
        name: str,
        seat: z.enum(["director", "observer", "independent", "founder", "unknown"]).catch("unknown"),
        affiliation: str,
        background: str,
        sources: strArr,
      }),
    ),
    boardNote: str,
    backers: arr(
      obj({
        name: str,
        relationship: z.enum(["investor", "advisor", "customer", "partner", "endorsement"]).catch("endorsement"),
        detail: str,
        sources: strArr,
      }),
    ),
  }),
  financials: obj({
    revenue: Claim,
    revenueGrowth: Claim,
    profitability: obj({
      status: z.enum(["profitable", "not_profitable", "not_disclosed"]).catch("not_disclosed"),
      detail: str,
      sources: strArr,
    }),
    grossMargin: Claim,
    burn: Claim,
    runway: obj({
      status: z.enum(["disclosed", "estimated", "not_disclosed"]).catch("not_disclosed"),
      value: str,
      assumptions: str,
      neededInfo: strArr,
      sources: strArr,
    }),
    businessModel: Claim,
    revenueStreams: arr(Claim),
    commercialRelationships: arr(Claim),
    assessment: obj({
      facts: arr(Claim),
      strengths: arr(Claim),
      risks: arr(Claim),
      questions: strArr,
    }),
  }),
  hiring: obj({
    checkedAt: str,
    sourceLabel: str,
    sourceUrl: str,
    method: z.enum(["job-board-api", "careers-page", "web-search", "none"]).catch("none"),
    totalOpenings: z.number().nullable().catch(null),
    note: str,
    roles: arr(
      obj({
        title: str,
        department: str,
        location: str,
        workMode: str,
        salary: str,
        url: str,
      }),
    ),
    interpretation: arr(Point),
  }),
  business: obj({
    product: Claim,
    customers: Claim,
    businessModel: Claim,
    distribution: Claim,
    differentiation: arr(Claim),
    trends: arr(Claim),
    competitors: arr(
      obj({ name: str, website: str, positioning: str, difference: str, sources: strArr }),
    ),
  }),
  investorCase: obj({
    bull: arr(Point),
    bear: arr(Point),
    topPositives: arr(Claim),
    topConcerns: arr(Claim),
    mustBeTrue: strArr,
    diligenceQuestions: strArr,
    disclaimer: str,
  }),
  news: arr(
    obj({
      date: str,
      eventDate: str,
      kind: z
        .enum(["funding", "product", "acquisition", "partnership", "leadership", "customer", "regulatory", "other"])
        .catch("other"),
      title: str,
      summary: str,
      sources: strArr,
    }),
  ),
  sources: arr(Source),
  notes: strArr,
  /** Sections that have had on-demand deep research. */
  deepened: strArr,
});
export type Report = z.infer<typeof Report>;
export type Snapshot = Report["snapshot"];
