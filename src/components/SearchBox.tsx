"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { normalizeDomain } from "@/lib/domain";

export function SearchBox({ compact = false, autoFocus = false }: { compact?: boolean; autoFocus?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const domain = normalizeDomain(value);
    if (!domain) {
      setError("Enter a company website, like linear.app");
      return;
    }
    setError("");
    router.push(`/report/${domain}`);
  }

  if (compact)
    return (
      <form onSubmit={submit} role="search" className="relative">
        <label htmlFor="search-compact" className="sr-only">
          Analyze another company
        </label>
        <input
          id="search-compact"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Analyze another…"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="h-9 w-full rounded-full border border-line bg-card px-3.5 text-[13px] placeholder:text-faint focus:border-accent focus:outline-none"
        />
      </form>
    );

  return (
    <form onSubmit={submit} role="search" className="w-full">
      <div className="flex flex-col gap-2 rounded-[22px] border border-line-2 bg-card p-2 shadow-[0_10px_40px_-20px_rgba(22,21,15,0.35)] transition focus-within:border-accent sm:flex-row sm:items-center">
        <label htmlFor="search-main" className="sr-only">
          Company website
        </label>
        <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
          <span className="font-mono text-[13px] text-faint" aria-hidden>
            https://
          </span>
          <input
            id="search-main"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError("");
            }}
            placeholder="company.com"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus={autoFocus}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "search-error" : undefined}
            className="h-12 min-w-0 flex-1 bg-transparent text-[17px] placeholder:text-faint focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="h-12 shrink-0 rounded-2xl bg-ink px-6 text-[15px] font-medium text-paper transition hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Analyze company
        </button>
      </div>
      <p id="search-error" role="alert" className="mt-2 min-h-5 px-3 text-[13px] text-bear">
        {error}
      </p>
    </form>
  );
}
