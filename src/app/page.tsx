import Link from "next/link";
import { SearchBox } from "@/components/SearchBox";
import { SAMPLE_LIST, getSample } from "@/data/samples";

const SECTIONS = ["Founders", "Funding & investors", "Team growth", "Financial health", "Hiring", "Competition", "Bull vs. bear"];

export default function Home() {
  const samples = SAMPLE_LIST.map((s) => ({ ...s, report: getSample(s.domain)! }));
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <span className="font-serif text-[1.45rem] leading-none tracking-tight">
          Startup<span className="italic text-accent">side</span>
        </span>
        <a href="#examples" className="text-[13.5px] text-muted hover:text-ink">
          Example reports
        </a>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
        <section className="mx-auto max-w-3xl pt-14 pb-16 text-center sm:pt-24 sm:pb-24">
          <p className="rise font-mono text-[11px] tracking-[0.16em] text-faint uppercase">AI startup due diligence</p>
          <h1 className="rise mt-4 font-serif text-[3.1rem] leading-[0.98] tracking-[-0.02em] sm:text-[5.2rem]" style={{ animationDelay: "60ms" }}>
            Know the startup
            <br />
            behind the <span className="italic text-accent">pitch.</span>
          </h1>
          <p className="rise mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-ink-2 sm:text-[18px]" style={{ animationDelay: "120ms" }}>
            Founders, funding, team growth, financial health, and competitive intelligence—all in one place.
          </p>
          <div className="rise mx-auto mt-10 max-w-2xl text-left" style={{ animationDelay: "180ms" }}>
            <SearchBox />
          </div>
          <p className="rise mt-2 text-[13px] text-muted" style={{ animationDelay: "220ms" }}>
            No account needed. Every claim links to its source.
          </p>
        </section>

        <section id="examples" className="scroll-mt-6 border-t border-line pt-12 pb-20">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-[11px] tracking-[0.14em] text-faint uppercase">Example reports</p>
              <h2 className="mt-1.5 font-serif text-[2rem] leading-tight sm:text-[2.4rem]">See what you get</h2>
            </div>
            <p className="max-w-sm text-[14px] text-muted">Three companies with very different amounts of public information.</p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {samples.map(({ domain, name, blurb, report: r }) => (
              <Link
                key={domain}
                href={`/report/${domain}`}
                className="group flex flex-col rounded-2xl border border-line bg-card p-5 transition duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-[0_10px_32px_-16px_rgba(47,93,80,0.5)]"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-serif text-[1.9rem] leading-none">{name}</span>
                  <span className="font-mono text-[11px] text-faint">{domain}</span>
                </div>
                <p className="mt-2 text-[13px] text-muted">{blurb}</p>
                <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 text-[13px]">
                  <div>
                    <dt className="text-faint">Funding</dt>
                    <dd className="mt-0.5 leading-snug">{r.snapshot.funding.headline}</dd>
                  </div>
                  <div>
                    <dt className="text-faint">Hiring</dt>
                    <dd className="mt-0.5 leading-snug">{r.snapshot.hiring.headline}</dd>
                  </div>
                </dl>
                <span className="mt-5 text-[13px] font-medium text-accent">Open report →</span>
              </Link>
            ))}
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              ["Built on sources", "Live web research, company sites and public job boards. Every claim carries a citation you can open."],
              ["Honest about unknowns", "Verified, inferred and unknown are always labeled. Missing numbers say “Not disclosed” — never a guess."],
              ["Readable in a minute", "A six-card executive snapshot up top. Expand anything for the deeper research behind it."],
            ].map(([t, d]) => (
              <div key={t}>
                <p className="font-serif text-[1.4rem]">{t}</p>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap gap-2">
            {SECTIONS.map((s) => (
              <span key={s} className="rounded-full border border-line px-3 py-1 text-[12.5px] text-muted">
                {s}
              </span>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl border-t border-line px-4 py-6 text-[12.5px] text-muted sm:px-6">
        Research summaries from public information — not investment, legal or career advice. No paid databases or LinkedIn logins are used.
      </footer>
    </div>
  );
}
