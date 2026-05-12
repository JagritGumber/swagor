/**
 * Live Trade Card — the visual centerpiece of the landing.
 *
 * Mock OHLCV-style price line with entry + exit markers, PnL breakdown,
 * panel verdict mini-summary, and the on-chain anchor link. Replaces the
 * boring stats counter strip with a single concrete artifact that shows
 * "this is what every trade looks like on your dashboard."
 *
 * Below the card, a compressed traction strip preserves the credibility
 * signals (trades anchored, cycles run, active users).
 *
 * Palette discipline: cyan for line + brand, white for chrome, green for
 * positive PnL only. No amber. No red except loss-signaling (none here).
 */

import { ArrowUpRight, Check } from "lucide-react";

const CHART_POINTS = [
  98, 100, 99, 102, 105, 103, 108, 110, 115, 118,
  117, 122, 125, 127, 130, 132, 130, 134, 138, 141,
  144, 142, 148, 151, 155, 158, 156, 160, 162, 165,
];
const ENTRY_IDX = 8;   // entered at 115
const EXIT_IDX = 25;   // exited at 158

const W = 1000;
const H = 280;

function chartScales() {
  const min = Math.min(...CHART_POINTS);
  const max = Math.max(...CHART_POINTS);
  const range = max - min || 1;
  const step = W / (CHART_POINTS.length - 1);
  const yAt = (i: number) => H - ((CHART_POINTS[i] - min) / range) * (H * 0.85) - H * 0.08;
  const xAt = (i: number) => i * step;
  return { yAt, xAt };
}

const TRACTION = [
  { label: "Trades anchored", value: "247" },
  { label: "Cycles run", value: "1,284" },
  { label: "Active users", value: "32" },
];

export function LiveTradeCard() {
  const { xAt, yAt } = chartScales();
  const pathD = CHART_POINTS.map((_, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(i).toFixed(1)}`).join(" ");
  const areaD = `${pathD} L ${xAt(CHART_POINTS.length - 1).toFixed(1)} ${H} L 0 ${H} Z`;

  return (
    <section
      aria-labelledby="trade-card-heading"
      className="border-b border-[var(--hairline-strong)] bg-black"
    >
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <header className="mb-10 max-w-2xl">
          <div className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--neon-cyan)]">
            // last trade · cycle 0x4f7c…a812
          </div>
          <h2
            id="trade-card-heading"
            className="mt-3 text-3xl font-bold leading-[1.1] tracking-tight text-balance sm:text-4xl md:text-5xl"
          >
            This is what every trade looks like.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-foreground/75">
            Asset, venue, entry and exit, PnL, the panel's verdict, and the on-chain anchor. One card per cycle. Every field verifiable.
          </p>
        </header>

        <article className="border border-[var(--hairline-strong)] bg-black">
          {/* Top strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--hairline-strong)] bg-[#080808] px-5 py-4">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-lg font-bold text-foreground">USDe / USDC</span>
              <span className="font-mono text-xs text-foreground/65">aave-v3-eth</span>
            </div>
            <div className="flex items-center gap-4 font-mono text-xs">
              <span className="inline-flex items-center gap-1.5 text-[var(--neon-cyan)]">
                <Check className="h-3.5 w-3.5" aria-hidden />
                <span>panel approved 2-1</span>
              </span>
              <span aria-hidden className="text-foreground/35">·</span>
              <span className="text-foreground/65">3h 14m duration</span>
            </div>
          </div>

          {/* Chart */}
          <div className="relative bg-[radial-gradient(ellipse_at_top,rgba(0,212,255,0.05),transparent_60%)]">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="block h-[260px] w-full sm:h-[300px]"
              role="img"
              aria-label="Trade price chart from $98 entry-zone climbing to $168 with entry marker at 115 and exit marker at 158"
            >
              {/* horizontal grid */}
              {[0.25, 0.5, 0.75].map((p) => (
                <line key={p} x1="0" y1={H * p} x2={W} y2={H * p} stroke="rgba(255,255,255,0.04)" />
              ))}
              {/* area under curve */}
              <path d={areaD} fill="url(#grad-cyan)" opacity="0.35" />
              <defs>
                <linearGradient id="grad-cyan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--neon-cyan)" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="var(--neon-cyan)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* price line */}
              <path d={pathD} stroke="var(--neon-cyan)" strokeWidth="2" fill="none" />
              {/* entry */}
              <line x1={xAt(ENTRY_IDX)} y1="0" x2={xAt(ENTRY_IDX)} y2={H} stroke="var(--neon-green)" strokeDasharray="4 4" opacity="0.5" />
              <circle cx={xAt(ENTRY_IDX)} cy={yAt(ENTRY_IDX)} r="7" fill="var(--neon-green)" />
              <circle cx={xAt(ENTRY_IDX)} cy={yAt(ENTRY_IDX)} r="3.5" fill="#000" />
              <text x={xAt(ENTRY_IDX) + 12} y={yAt(ENTRY_IDX) - 10} fontSize="11" fill="var(--neon-green)" fontFamily="ui-monospace, monospace" letterSpacing="0.5">
                entry · $115.00
              </text>
              {/* exit */}
              <line x1={xAt(EXIT_IDX)} y1="0" x2={xAt(EXIT_IDX)} y2={H} stroke="#ffffff" strokeDasharray="4 4" opacity="0.4" />
              <circle cx={xAt(EXIT_IDX)} cy={yAt(EXIT_IDX)} r="7" fill="#ffffff" />
              <circle cx={xAt(EXIT_IDX)} cy={yAt(EXIT_IDX)} r="3.5" fill="#000" />
              <text x={xAt(EXIT_IDX) - 80} y={yAt(EXIT_IDX) - 12} fontSize="11" fill="#ffffff" fontFamily="ui-monospace, monospace" letterSpacing="0.5">
                exit · $158.21
              </text>
            </svg>
          </div>

          {/* Bottom strip */}
          <div className="grid grid-cols-2 gap-px border-t border-[var(--hairline-strong)] bg-[var(--hairline)] sm:grid-cols-4">
            <Cell label="PnL" mono value="+$43.21" valueClass="text-[var(--neon-green)]" />
            <Cell label="PnL %" mono value="+37.4%" valueClass="text-[var(--neon-green)]" />
            <Cell label="Size" mono value="$115.00" />
            <div className="bg-black px-5 py-4">
              <div className="font-mono text-xs uppercase tracking-[0.12em] text-foreground/70">Anchored</div>
              <a
                href="https://testnet.arcscan.app"
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 font-mono text-base text-[var(--neon-cyan)] underline-offset-4 hover:underline"
              >
                <span>0x09da…0818</span>
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </a>
            </div>
          </div>
        </article>

        {/* compressed traction strip */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--hairline)] pt-6 text-sm">
          <span className="text-foreground/70">
            All-time, all users
          </span>
          <ul className="flex flex-wrap gap-x-8 gap-y-3">
            {TRACTION.map((t) => (
              <li key={t.label} className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold text-foreground tabular-nums">{t.value}</span>
                <span className="text-foreground/70">{t.label.toLowerCase()}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Cell({
  label,
  value,
  mono,
  valueClass,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="bg-black px-5 py-4">
      <div className="font-mono text-xs uppercase tracking-[0.12em] text-foreground/70">
        {label}
      </div>
      <div
        className={`mt-1 text-xl font-bold tabular-nums ${mono ? "font-mono" : ""} ${valueClass ?? "text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}
