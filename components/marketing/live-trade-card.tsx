/**
 * Sample Cycle. Aspirational framing with SEC-style disclosure.
 * Header tightened so the card lands in the same viewport. Disclosure
 * moved below the card and styled like body description.
 */

import { ArrowUpRight } from "lucide-react";
import { LEGAL_DISCLOSURE_SHORT, SAMPLE_CYCLE } from "@/lib/marketing-data";
import { SectionEyebrow } from "./section-eyebrow";

const CHART = [
  98, 100, 99, 102, 105, 103, 108, 110, 115, 118,
  117, 122, 125, 127, 130, 132, 130, 134, 138, 141,
  144, 142, 148, 151, 155, 158, 156, 160, 162, 165,
];
const ENTRY_IDX = 8;
const EXIT_IDX = 25;
const W = 1000;
const H = 300;

function scales() {
  const min = Math.min(...CHART);
  const max = Math.max(...CHART);
  const range = max - min || 1;
  const step = W / (CHART.length - 1);
  const yAt = (i: number) => H - ((CHART[i] - min) / range) * (H * 0.78) - H * 0.12;
  const xAt = (i: number) => i * step;
  return { xAt, yAt };
}

export function LiveTradeCard() {
  const { xAt, yAt } = scales();
  const pathD = CHART.map((_, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(i).toFixed(1)}`).join(" ");
  const areaD = `${pathD} L ${xAt(CHART.length - 1).toFixed(1)} ${H} L 0 ${H} Z`;

  return (
    <section
      aria-labelledby="sample-cycle-heading"
      className="border-b border-[var(--hairline-strong)] bg-black"
    >
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <header className="mb-10 max-w-3xl">
          <SectionEyebrow>Sample cycle</SectionEyebrow>
          <h2
            id="sample-cycle-heading"
            className="mt-4 text-[40px] font-bold uppercase leading-[1.05] tracking-tight text-balance text-foreground"
          >
            What we <span className="text-[var(--neon-cyan)]">aim for</span> when a trade goes through.
          </h2>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">
            One deliberation, taken apart. The signal, the call, the dissent, the recording on Arc. Numbers shown are illustrative. The structure is the point.
          </p>
        </header>

        <article className="overflow-hidden border border-[var(--hairline-strong)] bg-black">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--hairline-strong)] bg-[#080808] px-6 py-5">
            <div>
              <div className="text-[28px] font-bold uppercase leading-none text-foreground">
                {SAMPLE_CYCLE.pair}
              </div>
              <div className="mt-2 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {SAMPLE_CYCLE.venue}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-[var(--neon-green)]">
                Panel approved · 2 to 1
              </span>
              <span className="font-mono text-sm uppercase tracking-[0.16em] text-muted-foreground">
                {SAMPLE_CYCLE.duration}
              </span>
            </div>
          </div>

          <div className="relative bg-[radial-gradient(ellipse_at_top,rgba(0,212,255,0.06),transparent_55%)]">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="block h-[280px] w-full sm:h-[340px]"
              role="img"
              aria-label="Hypothetical price line for the sample USDe / USDC trade, climbing from $98 area to $168 with entry marked at $115 and exit at $158."
            >
              <defs>
                <linearGradient id="grad-accent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--neon-cyan)" stopOpacity="0.30" />
                  <stop offset="100%" stopColor="var(--neon-cyan)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((p) => (
                <line key={p} x1="0" y1={H * p} x2={W} y2={H * p} stroke="rgba(255,255,255,0.04)" />
              ))}
              <path d={areaD} fill="url(#grad-accent)" className="chart-mark" />
              <path d={pathD} stroke="var(--neon-cyan)" strokeWidth="2" fill="none" className="chart-line" />
              <g className="chart-mark">
                <line x1={xAt(ENTRY_IDX)} y1="0" x2={xAt(ENTRY_IDX)} y2={H} stroke="var(--neon-green)" strokeDasharray="4 5" opacity="0.5" />
                <circle cx={xAt(ENTRY_IDX)} cy={yAt(ENTRY_IDX)} r="7" fill="var(--neon-green)" />
                <circle cx={xAt(ENTRY_IDX)} cy={yAt(ENTRY_IDX)} r="3" fill="#000" />
                <text x={xAt(ENTRY_IDX) + 12} y={yAt(ENTRY_IDX) - 12} fontSize="12" fill="var(--neon-green)" fontFamily="ui-monospace, monospace" letterSpacing="0.5">
                  in · ${CHART[ENTRY_IDX]}
                </text>
                <line x1={xAt(EXIT_IDX)} y1="0" x2={xAt(EXIT_IDX)} y2={H} stroke="#ffffff" strokeDasharray="4 5" opacity="0.45" />
                <circle cx={xAt(EXIT_IDX)} cy={yAt(EXIT_IDX)} r="7" fill="#ffffff" />
                <circle cx={xAt(EXIT_IDX)} cy={yAt(EXIT_IDX)} r="3" fill="#000" />
                <text x={xAt(EXIT_IDX) - 70} y={yAt(EXIT_IDX) - 14} fontSize="12" fill="#ffffff" fontFamily="ui-monospace, monospace" letterSpacing="0.5">
                  out · ${CHART[EXIT_IDX]}
                </text>
              </g>
            </svg>
          </div>

          <div className="grid grid-cols-2 gap-px border-t border-[var(--hairline-strong)] bg-[var(--hairline)] sm:grid-cols-4">
            <Stat label="P/L" value={SAMPLE_CYCLE.pnlUsd} tone="up" />
            <Stat label="P/L %" value={SAMPLE_CYCLE.pnlPctPlain} tone="up" />
            <Stat label="Position" value={`$${CHART[ENTRY_IDX]}.00`} />
            <a
              href="https://testnet.arcscan.app"
              target="_blank"
              rel="noreferrer"
              className="group bg-black px-6 py-5 transition hover:bg-[#080808]"
            >
              <div className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Recorded on Arc
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 font-mono text-xl text-[var(--neon-cyan)] underline-offset-4 group-hover:underline">
                {SAMPLE_CYCLE.arcTx}
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </div>
            </a>
          </div>
        </article>

        {/* Disclosure sits below the card, styled like body description (not as a mono code label). */}
        <p className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground">
          {LEGAL_DISCLOSURE_SHORT}
        </p>
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  const toneClass = tone === "up" ? "text-[var(--neon-green)]" : tone === "down" ? "text-[var(--neon-red)]" : "text-foreground";
  return (
    <div className="bg-black px-6 py-5">
      <div className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className={`mt-2 text-[28px] font-bold tabular-nums ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}
