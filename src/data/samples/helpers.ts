import type { Claim, Point, Status } from "@/lib/schema";

/** Verified claim backed by the given source ids. */
export const v = (text: string, ...sources: string[]): Claim => ({ text, status: "verified", sources });
/** Inferred claim: an interpretation of the cited evidence. */
export const inf = (text: string, ...sources: string[]): Claim => ({ text, status: "inferred", sources });
/** Unknown: not publicly established. */
export const unk = (text = "Not disclosed"): Claim => ({ text, status: "unknown", sources: [] });

export const pt = (title: string, detail: string, status: Status, ...sources: string[]): Point => ({
  title,
  detail,
  status,
  sources,
});

export type Board = { checkedAt: string; boardUrl: string; roles: { title: string; department: string; location: string; workMode: string; salary: string; url: string }[] };
