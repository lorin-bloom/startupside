"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Report } from "@/lib/schema";

/**
 * On-demand deep research. The first pass covers the essentials; a reader can
 * ask for more on founders, investors, financials or competitors, and only
 * then is that research run (and paid for).
 */
export type DeepSection = "founders" | "investors" | "financials" | "market";

type Ctx = {
  enabled: boolean;
  deepened: string[];
  pending: DeepSection | null;
  error: { section: DeepSection; message: string } | null;
  run: (section: DeepSection) => void;
};

const DeepenContext = createContext<Ctx>({ enabled: false, deepened: [], pending: null, error: null, run: () => {} });

export function DeepenProvider({
  report,
  onReportChange,
  children,
}: {
  report: Report;
  onReportChange?: (r: Report) => void;
  children: ReactNode;
}) {
  const [pending, setPending] = useState<DeepSection | null>(null);
  const [error, setError] = useState<Ctx["error"]>(null);

  const run = useCallback(
    async (section: DeepSection) => {
      setPending(section);
      setError(null);
      try {
        const res = await fetch("/api/deepen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain: report.company.domain, section, report }),
        });
        const data = (await res.json().catch(() => ({}))) as { report?: Report; error?: string };
        if (!res.ok || !data.report) throw new Error(data.error || "Deeper research failed. Please try again.");
        onReportChange?.(data.report);
      } catch (err) {
        setError({ section, message: err instanceof Error ? err.message : "Request failed." });
      } finally {
        setPending(null);
      }
    },
    [report, onReportChange],
  );

  const value = useMemo(
    () => ({ enabled: report.mode === "live" && Boolean(onReportChange), deepened: report.deepened, pending, error, run }),
    [report.mode, report.deepened, onReportChange, pending, error, run],
  );
  return <DeepenContext.Provider value={value}>{children}</DeepenContext.Provider>;
}

export function useDeepen() {
  return useContext(DeepenContext);
}

/** "Research deeper" control shown in a section header. Hidden on sample reports. */
export function DeepenButton({ section, label }: { section: DeepSection; label: string }) {
  const { enabled, deepened, pending, error, run } = useDeepen();
  if (!enabled) return null;

  if (deepened.includes(section))
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-verified">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path d="M2.5 6.5 5 9l4.5-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Researched in depth
      </span>
    );

  const busy = pending === section;
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => run(section)}
        disabled={Boolean(pending)}
        className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-card px-3.5 py-1.5 text-[13px] font-medium text-accent transition hover:border-accent disabled:opacity-60"
      >
        {busy ? (
          <>
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" />
            Researching… about a minute
          </>
        ) : (
          <>
            <span aria-hidden>＋</span>
            {label}
          </>
        )}
      </button>
      {error?.section === section && (
        <span role="alert" className="text-[12.5px] text-bear">
          {error.message}
        </span>
      )}
    </span>
  );
}
