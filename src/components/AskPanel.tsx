"use client";

import { useEffect, useRef, useState } from "react";
import type { Report } from "@/lib/schema";
import { Cite, hostOf } from "./ui";

type Msg = { role: "user" | "assistant"; text: string; webSources?: { url: string; title: string }[]; error?: boolean };

const SUGGESTIONS = [
  "Tell me more about the founders' previous companies.",
  "Why did the lead investor back this company?",
  "What evidence supports the growth opportunity?",
  "Explain the business model in simpler terms.",
  "What are the biggest risks of joining this company?",
  "Compare this startup with its closest competitor.",
];

/** Renders answer text: "- " bullets, and [R:id] report citations as chips. */
function Answer({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  const inline = (line: string, key: number) => {
    const parts = line.split(/(\[R:[\w,\s:R]+\])/g);
    return (
      <span key={key}>
        {parts.map((p, i) => {
          const m = p.match(/^\[R:([\w,\s:R]+)\]$/);
          if (!m) return <span key={i}>{p.replace(/\*\*/g, "")}</span>;
          const ids = m[1].split(/[,\s]+/).map((x) => x.replace(/^R:/, "")).filter(Boolean);
          return <Cite key={i} ids={ids} />;
        })}
      </span>
    );
  };
  return (
    <div className="space-y-2.5">
      {blocks.map((b, i) => {
        const lines = b.split("\n").filter(Boolean);
        if (lines.every((l) => /^\s*[-•*]\s/.test(l)))
          return (
            <ul key={i} className="list-disc space-y-1 pl-4">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-•*]\s/, ""), j)}</li>
              ))}
            </ul>
          );
        return <p key={i}>{lines.map((l, j) => inline(l, j))}</p>;
      })}
    </div>
  );
}

export function AskPanel({ report }: { report: Report }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    const history = messages.filter((m) => !m.error).map(({ role, text }) => ({ role, text }));
    setMessages((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: report.company.domain, question: q, history, report: report.mode === "live" ? report : undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { answer?: string; webSources?: Msg["webSources"]; error?: string };
      if (!res.ok || !data.answer) throw new Error(data.error || "Something went wrong. Please try again.");
      setMessages((m) => [...m, { role: "assistant", text: data.answer!, webSources: data.webSources }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", text: err instanceof Error ? err.message : "Request failed.", error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-4 z-40 inline-flex items-center gap-2 rounded-full bg-ink py-3 pr-5 pl-4 text-[14px] font-medium text-paper shadow-[0_12px_32px_-12px_rgba(22,21,15,0.6)] transition hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:right-6 sm:bottom-6"
        >
          <span className="font-serif text-lg leading-none italic">?</span>
          Ask Startupside
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Ask Startupside"
          className="rise fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-3xl border border-line bg-card shadow-[0_-12px_48px_-16px_rgba(22,21,15,0.35)] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:h-[600px] sm:max-h-[calc(100dvh-48px)] sm:w-[420px] sm:rounded-3xl"
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <div>
              <p className="font-serif text-xl leading-none">Ask Startupside</p>
              <p className="mt-1 text-xs text-muted">Answers from this report, plus fresh web research when needed.</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-full p-2 text-muted hover:bg-paper hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-[14px] leading-relaxed" aria-live="polite">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-[13px] text-muted">Try asking about {report.company.name || "this company"}:</p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => ask(s)}
                    className="block w-full rounded-xl border border-line px-3.5 py-2.5 text-left text-[13.5px] text-ink-2 transition hover:border-accent hover:text-ink"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="ml-8 rounded-2xl rounded-br-md bg-paper px-3.5 py-2.5 text-ink">
                  {m.text}
                </div>
              ) : (
                <div key={i} className={m.error ? "rounded-xl bg-bear-soft px-3.5 py-2.5 text-bear" : "text-ink-2"}>
                  {m.error ? m.text : <Answer text={m.text} />}
                  {m.webSources && m.webSources.length > 0 && (
                    <div className="mt-3 border-t border-line pt-2.5">
                      <p className="font-mono text-[10.5px] tracking-[0.12em] text-faint uppercase">New web sources</p>
                      <ul className="mt-1.5 space-y-1 text-[12.5px]">
                        {m.webSources.map((s) => (
                          <li key={s.url} className="truncate">
                            <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                              {s.title || hostOf(s.url)}
                            </a>
                            <span className="text-faint"> · {hostOf(s.url)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ),
            )}
            {busy && (
              <div className="flex items-center gap-2 text-[13px] text-muted">
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" />
                Researching…
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="border-t border-line p-3"
          >
            <div className="flex items-end gap-2 rounded-2xl border border-line bg-paper p-1.5 focus-within:border-accent">
              <label htmlFor="ask-input" className="sr-only">
                Your question
              </label>
              <textarea
                id="ask-input"
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    ask(input);
                  }
                }}
                rows={1}
                maxLength={600}
                placeholder="Ask a follow-up question…"
                className="max-h-28 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-[14px] placeholder:text-faint focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || input.trim().length < 3}
                className="h-9 shrink-0 rounded-xl bg-ink px-4 text-[13px] font-medium text-paper transition hover:bg-accent disabled:opacity-30"
              >
                Ask
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
