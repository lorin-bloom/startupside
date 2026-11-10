import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { config, pricing } from "./config";

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic({ apiKey: config.apiKey, maxRetries: 2, timeout: 280_000 }));

export type AgentRun = {
  text: string;
  /** Every URL that appeared in real search/fetch results during the run. */
  retrievedUrls: Set<string>;
  /** Web citations attached by the API to the final text. */
  citations: { url: string; title: string }[];
  costUsd: number;
};

type Opts = {
  system: string;
  prompt: string;
  /** Extra content blocks (e.g. uploaded screenshots) placed before the prompt. */
  attachments?: Anthropic.Beta.BetaContentBlockParam[];
  maxSearches?: number;
  maxFetches?: number;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
};

const URL_RE = /https?:\/\/[^\s"'<>\\)\]]+/g;

export function normalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = "";
    for (const p of [...url.searchParams.keys()]) if (/^utm_|^ref$|^fbclid$|^gclid$/i.test(p)) url.searchParams.delete(p);
    return url.toString().replace(/\/$/, "").replace(/^http:/, "https:").replace("://www.", "://");
  } catch {
    return u;
  }
}

/**
 * Runs one research agent with live web search + fetch. Handles `pause_turn`
 * continuations, sums cost across them, and records which URLs the tools
 * actually returned so citations can be checked against real retrievals.
 */
export async function runAgent(opts: Opts): Promise<AgentRun> {
  // Haiku 5.5 doesn't support the newer (dynamic-filtering) web tool versions.
  const tools: Anthropic.Beta.BetaToolUnion[] = [];
  if (opts.maxSearches)
    tools.push(
      config.isHaiku
        ? { type: "web_search_20250305", name: "web_search", max_uses: opts.maxSearches }
        : { type: "web_search_20260209", name: "web_search", max_uses: opts.maxSearches },
    );
  if (opts.maxFetches)
    tools.push(
      config.isHaiku
        ? { type: "web_fetch_20250910", name: "web_fetch", max_uses: opts.maxFetches, max_content_tokens: 8000 }
        : { type: "web_fetch_20260209", name: "web_fetch", max_uses: opts.maxFetches, max_content_tokens: 12000 },
    );

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: [...(opts.attachments ?? []), { type: "text", text: opts.prompt }] },
  ];
  const retrievedUrls = new Set<string>();
  const citations: AgentRun["citations"] = [];
  let costUsd = 0;
  let finalText = "";

  for (let turn = 0; turn < 5; turn++) {
    const stream = anthropic().beta.messages.stream({
      model: config.model,
      max_tokens: opts.maxTokens ?? 24000,
      // Server-side refusal fallback exists for Opus/Sonnet, not for Haiku.
      ...(config.isHaiku ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }),
      thinking: { type: "adaptive" },
      output_config: { effort: opts.effort ?? "medium" },
      system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
      tools: tools.length ? tools : undefined,
      messages,
    });
    const msg = await stream.finalMessage();

    const u = msg.usage;
    const price = pricing((u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0));
    costUsd +=
      ((u.input_tokens ?? 0) * price.input +
        (u.output_tokens ?? 0) * price.output +
        (u.cache_read_input_tokens ?? 0) * price.cacheRead +
        (u.cache_creation_input_tokens ?? 0) * price.cacheWrite) /
        1e6 +
      (u.server_tool_use?.web_search_requests ?? 0) * config.webSearchUsdPerSearch;

    let textThisTurn = "";
    for (const block of msg.content) {
      if (block.type === "text") {
        textThisTurn += block.text;
        for (const c of block.citations ?? []) {
          if ("url" in c && c.url) citations.push({ url: c.url, title: ("title" in c && c.title) || c.url });
        }
      } else if (block.type !== "thinking" && block.type !== "redacted_thinking") {
        // Tool results (search hits, fetched pages): harvest every URL they contain.
        for (const m of JSON.stringify(block).matchAll(URL_RE)) retrievedUrls.add(normalizeUrl(m[0]));
      }
    }
    finalText += textThisTurn;

    if (msg.stop_reason === "refusal") throw new Error("The model declined this research request.");
    if (msg.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: msg.content });
  }

  return { text: finalText, retrievedUrls, citations, costUsd };
}

/** Pulls the JSON object out of a model response (tolerates fences and chatter). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced && fenced[1].includes("{") ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON found in model output");
  const raw = body.slice(start, end + 1);
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(raw.replace(/,\s*([}\]])/g, "$1"));
  }
}

export function apiErrorMessage(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "The server's AI API key was rejected.";
  if (err instanceof Anthropic.RateLimitError) return "The AI provider is rate limiting requests. Try again in a minute.";
  if (err instanceof Anthropic.APIError) return `The AI provider returned an error (${err.status ?? "network"}).`;
  if (err instanceof Error) return err.message;
  return "Unexpected error";
}
