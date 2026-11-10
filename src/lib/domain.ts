/**
 * Turns whatever a person types ("Linear.app", "https://www.linear.app/about")
 * into a bare registrable-looking hostname, or null if it isn't a plausible
 * public website. Shared by the client and the server.
 */
export function normalizeDomain(input: string): string | null {
  let raw = input.trim().toLowerCase();
  if (!raw || raw.length > 253) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(raw)) raw = `https://${raw}`;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== "80" && url.port !== "443") return null;
  let host = url.hostname.replace(/\.$/, "");
  if (host.startsWith("www.")) host = host.slice(4);
  // Hostnames only: no IP literals, no single-label or internal names.
  if (/^[\d.]+$/.test(host) || host.includes(":") || host.startsWith("[")) return null;
  if (!/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(host)) return null;
  if (/\.(local|localhost|internal|test|invalid|example|lan|home|corp)$/.test(host)) return null;
  return host;
}
