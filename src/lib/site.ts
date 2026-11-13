import "server-only";
import { safeFetch } from "./safe-fetch";

export type SiteInfo = {
  url: string;
  title: string;
  description: string;
  siteName: string;
  logoUrl: string;
  text: string;
  careersUrl: string;
  careersText: string;
  linkedinUrl: string;
  links: string[];
};

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

function meta(html: string, key: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${key}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${key}["']`,
    "i",
  );
  const m = html.match(re);
  return decode((m?.[1] ?? m?.[2] ?? "").trim());
}

export function visibleText(html: string, max = 7000): string {
  return decode(
    html
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/(p|div|li|h\d|section|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
    .slice(0, max);
}

function links(html: string, base: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(decode(m[1]), base);
      if (u.protocol === "https:" || u.protocol === "http:") out.add(u.toString());
    } catch {}
  }
  return [...out].slice(0, 400);
}

function icon(html: string, base: string): string {
  const candidates = [
    ...html.matchAll(/<link[^>]+rel=["'][^"']*(apple-touch-icon|icon)[^"']*["'][^>]*>/gi),
  ].map((m) => m[0]);
  // Prefer apple-touch-icon (large, square), then any icon.
  candidates.sort((a, b) => Number(/apple-touch/i.test(b)) - Number(/apple-touch/i.test(a)));
  for (const tag of candidates) {
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (href && !href.startsWith("data:")) {
      try {
        return new URL(decode(href), base).toString();
      } catch {}
    }
  }
  return new URL("/favicon.ico", base).toString();
}

/** The company's own LinkedIn page, as linked from its website. */
function linkedinCompany(links: string[]): string {
  for (const l of links) {
    const m = l.match(/^https?:\/\/(?:[a-z]{2,3}\.|www\.)?linkedin\.com\/company\/([A-Za-z0-9_.%-]+)/);
    if (m) return `https://www.linkedin.com/company/${m[1]}`;
  }
  return "";
}

/** The site exists but refused our request (bot protection, rate limits, login walls). */
export class SiteBlockedError extends Error {
  constructor(public status: number) {
    super(`The website responded with status ${status}`);
  }
}

/** Minimal site info when the homepage can't be read; research continues from other sources. */
export function unreadSite(domain: string): SiteInfo {
  const url = `https://${domain}/`;
  return { url, title: "", description: "", siteName: "", logoUrl: `${url}favicon.ico`, text: "", careersUrl: "", careersText: "", linkedinUrl: "", links: [] };
}

export async function readSite(domain: string): Promise<SiteInfo> {
  const home = await safeFetch(`https://${domain}/`);
  if (home.status >= 400) throw new SiteBlockedError(home.status);
  const html = home.text;
  const all = links(html, home.url);

  const careersCandidate =
    all.find((l) => /jobs\.ashbyhq\.com|greenhouse\.io|jobs\.lever\.co|workable\.com|wellfound\.com/i.test(l)) ??
    all.find((l) => /\/(careers?|jobs|join(-us)?|work-with-us|hiring)(\/|$|\?)/i.test(new URL(l).pathname + "/"));

  let careersUrl = "";
  let careersText = "";
  let careersLinks: string[] = [];
  for (const candidate of [careersCandidate, `https://${domain}/careers`].filter(Boolean) as string[]) {
    try {
      const res = await safeFetch(candidate);
      if (res.status < 400 && res.text.length > 200) {
        careersUrl = res.url;
        careersText = visibleText(res.text, 5000);
        careersLinks = links(res.text, res.url);
        break;
      }
    } catch {}
  }

  return {
    url: home.url,
    title: decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? ""),
    description: meta(html, "description") || meta(html, "og:description"),
    siteName: meta(html, "og:site_name"),
    logoUrl: icon(html, home.url),
    text: visibleText(html),
    careersUrl,
    careersText,
    linkedinUrl: linkedinCompany([...all, ...careersLinks]),
    links: [...new Set([...all, ...careersLinks])],
  };
}
