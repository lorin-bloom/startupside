import "server-only";
import { config } from "./config";
import { Report } from "./schema";
import { store } from "./store";

/**
 * Finished reports are reused for REPORT_CACHE_DAYS (default 14), so looking up
 * the same startup again costs nothing. Deep dives update the cached copy.
 */
const key = (domain: string) => `report:v1:${domain}`;

export async function getCachedReport(domain: string): Promise<Report | null> {
  try {
    const hit = await store.get(key(domain));
    return hit ? Report.parse(JSON.parse(hit)) : null;
  } catch {
    return null;
  }
}

export async function saveReport(report: Report): Promise<void> {
  try {
    await store.set(key(report.company.domain), JSON.stringify(report), config.reportCacheDays * 86400);
  } catch (err) {
    console.error("cache write failed", err);
  }
}
