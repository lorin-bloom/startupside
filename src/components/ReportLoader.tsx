"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Report } from "@/lib/schema";
import { ReportView } from "./ReportView";

const STEPS = [
  ["site", "Reading the company website"],
  ["jobs", "Checking public job boards"],
  ["core", "Researching founders, funding, team and market"],
  ["synthesis", "Weighing the bull and bear case"],
] as const;

/**
 * Reports are also kept in this browser for 14 days, so reopening a company
 * (even tomorrow) shows the saved findings instantly and costs nothing.
 */
const LOCAL_DAYS = 14;
const localKey = (domain: string) => `startupside:report:${domain}`;

function readLocal(domain: string): Report | null {
  try {
    const raw = localStorage.getItem(localKey(domain));
    if (!raw) return null;
    const { savedAt, report } = JSON.parse(raw) as { savedAt: number; report: Report };
    return Date.now() - savedAt < LOCAL_DAYS * 86_400_000 ? report : null;
  } catch {
    return null;
  }
}

function writeLocal(report: Report) {
  if (report.mode !== "live") return;
  try {
    localStorage.setItem(localKey(report.company.domain), JSON.stringify({ savedAt: Date.now(), report }));
  } catch {}
}

type StepState = "pending" | "active" | "done" | "warn";
type Ev =
  | { type: "progress"; step: string; state: StepState; message?: string }
  | { type: "result"; report: Report }
  | { type: "error"; code: string; message: string };

export function ReportLoader({ domain, initial }: { domain: string; initial: Report | null }) {
  const [report, setReport] = useState<Report | null>(initial);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [steps, setSteps] = useState<Record<string, { state: StepState; message?: string }>>({});
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(false);

  const run = useCallback(
    async (refresh = false) => {
      setError(null);
      setSteps({});
      setElapsed(0);
      if (refresh) setReport(null);
      const t0 = Date.now();
      const timer = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ website: domain, refresh }),
        });
        if (!res.body) throw new Error("No response from server");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let finished = false;
        while (!finished) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            const ev = JSON.parse(line) as Ev;
            if (ev.type === "progress") setSteps((s) => ({ ...s, [ev.step]: { state: ev.state, message: ev.message } }));
            else if (ev.type === "result") {
              setReport(ev.report);
              writeLocal(ev.report);
              finished = true;
            } else if (ev.type === "error") {
              setError({ code: ev.code, message: ev.message });
              finished = true;
            }
          }
        }
        if (!finished) throw new Error("The connection closed before research finished. Please try again.");
      } catch (err) {
        setError({ code: "network", message: err instanceof Error ? err.message : "Network error" });
      } finally {
        clearInterval(timer);
      }
    },
    [domain],
  );

  useEffect(() => {
    if (initial || started.current) return;
    started.current = true;
    const saved = readLocal(domain);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore a report saved in this browser
    if (saved) setReport(saved);
    else run();
  }, [initial, domain, run]);

  const update = useCallback((next: Report) => {
    setReport(next);
    writeLocal(next);
  }, []);

  if (report) return <ReportView report={report} onRefresh={() => run(true)} onReportChange={update} />;

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6">
        <Link href="/" className="font-serif text-[1.35rem] leading-none tracking-tight">
          Startup<span className="italic text-accent">side</span>
        </Link>
      </header>
      <main className="mx-auto max-w-xl px-4 pt-16 pb-24 sm:pt-24">
        <p className="font-mono text-[11px] tracking-[0.14em] text-faint uppercase">Due diligence in progress</p>
        <h1 className="mt-2 font-serif text-[2.6rem] leading-[1.05] tracking-[-0.01em] break-words sm:text-5xl">{domain}</h1>

        {error ? (
          <div className="rise mt-10 rounded-2xl border border-line bg-card p-6">
            <p className="text-[15px] font-semibold">
              {error.code === "budget"
                ? "Daily research budget reached"
                : error.code === "rate_limited"
                  ? "Slow down a little"
                  : error.code === "live_disabled"
                    ? "Live research isn't available here"
                    : error.code === "invalid_url"
                      ? "That address doesn't look right"
                      : "We couldn't finish this report"}
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{error.message}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {!["budget", "rate_limited", "live_disabled", "invalid_url"].includes(error.code) && (
                <button type="button" onClick={() => run()} className="h-10 rounded-xl bg-ink px-4 text-[13.5px] font-medium text-paper hover:bg-accent">
                  Try again
                </button>
              )}
              <Link href="/#examples" className="inline-flex h-10 items-center rounded-xl border border-line px-4 text-[13.5px] font-medium hover:border-accent">
                Browse sample reports
              </Link>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-3 text-[15px] text-muted">
              Searching the web, reading primary sources and checking every citation. This usually takes about a minute.
            </p>
            <ol className="mt-10 space-y-4" aria-live="polite">
              {STEPS.map(([id, label]) => {
                const st = steps[id]?.state ?? "pending";
                return (
                  <li key={id} className="flex items-start gap-3">
                    <span className="mt-1.5 flex h-3 w-3 shrink-0 items-center justify-center">
                      {st === "done" && <span className="h-2.5 w-2.5 rounded-full bg-verified" />}
                      {st === "warn" && <span className="h-2.5 w-2.5 rounded-full bg-inferred" />}
                      {st === "active" && <span className="pulse-dot h-2.5 w-2.5 rounded-full bg-accent" />}
                      {st === "pending" && <span className="h-2.5 w-2.5 rounded-full border border-line-2" />}
                    </span>
                    <span>
                      <span className={`text-[15px] ${st === "pending" ? "text-faint" : "text-ink"}`}>{label}</span>
                      {steps[id]?.message && <span className="block text-[13px] text-muted">{steps[id]!.message}</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="tabular mt-10 font-mono text-[12px] text-faint">{elapsed}s elapsed</p>
          </>
        )}
      </main>
    </div>
  );
}
