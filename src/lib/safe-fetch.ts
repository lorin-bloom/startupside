import "server-only";
import { lookup } from "node:dns/promises";
import net from "node:net";

/**
 * Server-side fetch for untrusted URLs: public http(s) hosts only, every
 * redirect re-validated, short timeout, capped body size. Prevents the app
 * from being used to reach private networks or cloud metadata endpoints.
 */

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 4;
const UA = "Mozilla/5.0 (compatible; Startupside/1.0; company research)";

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateIp(v6.slice(7));
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only web addresses are supported");
  if (url.username || url.password) throw new Error("Credentials in URLs are not allowed");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("Non-standard ports are not allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) throw new Error("IP addresses are not allowed");
  const addrs = await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error("Host is not publicly reachable");
  return url;
}

export type FetchResult = { url: string; status: number; contentType: string; text: string };

export async function safeFetch(raw: string, accept = "text/html,application/json;q=0.9,*/*;q=0.5"): Promise<FetchResult> {
  let current = raw;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const url = await assertPublicUrl(current);
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": UA, Accept: accept },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, url).toString();
      continue;
    }
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) {
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
    }
    const text = new TextDecoder().decode(Buffer.concat(chunks));
    return { url: url.toString(), status: res.status, contentType: res.headers.get("content-type") ?? "", text };
  }
  throw new Error("Too many redirects");
}

export async function safeFetchJson<T>(raw: string): Promise<T | null> {
  try {
    const res = await safeFetch(raw, "application/json");
    if (res.status !== 200) return null;
    return JSON.parse(res.text) as T;
  } catch {
    return null;
  }
}
