import { Report } from "@/lib/schema";
import { linear } from "./linear";
import { ramp } from "./ramp";
import { resend } from "./resend";

/** Pre-researched reports that render without any API calls. */
const SAMPLES: Record<string, Report> = Object.fromEntries(
  [ramp, linear, resend].map((r) => [r.company.domain, Report.parse(r)]),
);

export const SAMPLE_LIST = [
  { domain: "ramp.com", name: "Ramp", blurb: "Late-stage fintech · lots of public data" },
  { domain: "linear.app", name: "Linear", blurb: "Growth-stage SaaS · profitable, private" },
  { domain: "resend.com", name: "Resend", blurb: "Early-stage dev tool · few financials" },
];

export function getSample(domain: string): Report | null {
  return SAMPLES[domain] ?? null;
}
