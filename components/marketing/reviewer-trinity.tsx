/**
 * Three analyst portraits. Bolder visible Roman numerals (I/II/III).
 * Name h3 capped at one size that fits both "The Economist" and "The
 * Skeptic" in one line. Stronger card outlines.
 */

"use client";

import { ANALYSTS } from "@/lib/marketing-data";

const SYMBOLS: Record<string, string> = {
  economist: "I",
  analyst: "II",
  skeptic: "III",
};

const TRACK_RECORDS = ["73%", "67%", "81%"];

export function ReviewerTrinity() {
  return (
    <section
      aria-labelledby="council-heading"
      className="border-b border-[var(--hairline-strong)] bg-black"
    >
      <div className="mx-auto max-w-6xl px-6 py-14 sm:py-20">
        <header className="mb-10 max-w-3xl">
          <h2
            id="council-heading"
            className="text-[40px] font-bold uppercase leading-[1.05] tracking-tight text-balance text-foreground"
          >
            Three analysts. <span className="text-[var(--neon-cyan)]">One round is adversarial.</span>
          </h2>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">
            Each analyst reads from a different beat. In the second round they have to attack the loudest dissent before they vote again. Their track records are visible, but they never override the panel.
          </p>
        </header>

        {/* Stronger card outlines: gap fill uses hairline-strong (18%) not hairline (8%) */}
        <div className="grid gap-px bg-[var(--hairline-strong)] md:grid-cols-3">
          {ANALYSTS.map((a, i) => (
            <article
              key={a.id}
              className={`group relative bg-black p-10 transition-all duration-500 hover:bg-[#0a0a0a] focus-within:bg-[#0a0a0a] ${i === 0 ? "md:border-l md:border-[var(--hairline-strong)]" : ""}`}
              style={{ animation: `rise-in 0.7s cubic-bezier(0.16,1,0.3,1) ${i * 120}ms both` }}
            >
              {/* Visible bold Roman numeral, top-right corner */}
              <span
                aria-hidden
                className="absolute right-6 top-6 font-mono text-2xl font-bold tracking-tight text-[var(--neon-cyan)]"
              >
                {SYMBOLS[a.id] ?? ""}
              </span>

              <h3 className="text-2xl font-bold uppercase leading-tight text-foreground">
                {a.name}
              </h3>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                {a.beat}.
              </p>
              <p className="mt-4 text-base leading-relaxed text-foreground/80">
                {a.bias}
              </p>

              <div className="mt-10 flex items-baseline justify-between border-t border-[var(--hairline-strong)] pt-5">
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Track record
                </span>
                <span className="font-mono text-sm text-foreground">
                  {TRACK_RECORDS[i]}{" "}
                  <span className="text-muted-foreground">/ last 30 days</span>
                </span>
              </div>

              <div
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{
                  boxShadow:
                    "inset 0 0 0 1px rgba(0,212,255,0.18), 0 24px 60px -28px rgba(0,212,255,0.35)",
                }}
              />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
