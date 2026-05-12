/**
 * Scrubable Panel Debate. Three tabs (Round 1 / Round 2 / Synthesis) with
 * keyboard-accessible role="tab" semantics. Verdict signaling uses
 * symbol prefixes (✓ / ! / ✗) plus cyan/white treatment — no green/amber/red
 * branding clutter. Reviewer rows tinted only by mono name color (cyan/white)
 * to keep palette disciplined.
 */

"use client";

import { useState } from "react";

type Line = {
  who: "hermes" | "athena" | "cassandra";
  verdict: "approve" | "concern" | "reject";
  text: string;
};

const ROUND_1: Line[] = [
  { who: "hermes", verdict: "concern", text: "CPI beat supports a risk-on tilt this week. PT-eUSDe yield is attractive given dovish FOMC pricing, but I want a clear exit by Friday's PCE." },
  { who: "athena", verdict: "approve", text: "Pendle PT-eUSDe market has $48M TVL, 7-day depth stable. Spot slippage at 60% size estimated 0.18%. Venue is fine." },
  { who: "cassandra", verdict: "reject", text: "USDe TVL is down 41% over 30 days. Concentration risk on Ethena's reserve mix is mispriced. A peg wobble before expiry blows up the position." },
];

const ROUND_2: Line[] = [
  { who: "hermes", verdict: "concern", text: "Cassandra's TVL drop is real, but it signals redemption pressure, not peg break. Downgrading to concern. Tightening exit to Wednesday close." },
  { who: "athena", verdict: "approve", text: "Spot depth and TVL are independent on a 21-day horizon. The pool can absorb the rotation tomorrow. Maintaining approve." },
  { who: "cassandra", verdict: "reject", text: "Spot depth is irrelevant if the underlying loses its peg. The tail risk stands. Maintaining reject." },
];

type TabId = "round-1" | "round-2" | "synthesis";
const TABS: { id: TabId; label: string }[] = [
  { id: "round-1", label: "Round 01 · independent" },
  { id: "round-2", label: "Round 02 · adversarial" },
  { id: "synthesis", label: "Synthesis · anchored" },
];

const NAME_TONE: Record<Line["who"], string> = {
  hermes: "text-foreground",
  athena: "text-[var(--neon-cyan)]",
  cassandra: "text-foreground",
};

const VERDICT_GLYPH: Record<Line["verdict"], string> = {
  approve: "✓",
  concern: "!",
  reject: "✗",
};

function VerdictPill({ verdict }: { verdict: Line["verdict"] }) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-[var(--hairline-strong)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-foreground/85">
      <span aria-hidden className="text-[var(--neon-cyan)]">{VERDICT_GLYPH[verdict]}</span>
      <span>{verdict}</span>
    </span>
  );
}

function LineRow({ line }: { line: Line }) {
  return (
    <div className="flex flex-col gap-2 border-b border-[var(--hairline)] py-4 last:border-b-0 sm:flex-row sm:items-start sm:gap-5">
      <div className="flex shrink-0 items-center gap-3 sm:w-44">
        <span className={`font-mono text-sm font-bold uppercase tracking-[0.1em] ${NAME_TONE[line.who]}`}>
          {line.who}
        </span>
        <VerdictPill verdict={line.verdict} />
      </div>
      <p className="flex-1 text-sm leading-relaxed text-foreground/85">
        {line.text}
      </p>
    </div>
  );
}

function Synthesis() {
  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-foreground/85">
        The council split 2-1. Cassandra held her reject; Hermes downgraded to concern, attacked her dissent, and tightened the exit to Wednesday close. Athena maintained approve. The synthesis writer composed the panel verdict and the trade was anchored on Arc with the dissent preserved verbatim.
      </p>
      <div className="grid grid-cols-2 gap-px border border-[var(--hairline-strong)] bg-[var(--hairline)] text-sm sm:grid-cols-4">
        <SynthCell label="Final verdict" value="approve" mono />
        <SynthCell label="Vote counts" value="2-1" mono />
        <SynthCell label="Dispersion" value="0.67" mono />
        <SynthCell label="Dissent" value="cassandra · tail risk" mono />
      </div>
      <div className="flex flex-col gap-2 border-t border-[var(--hairline)] pt-4 text-sm text-foreground/75 sm:flex-row sm:gap-8">
        <span>Final size: <span className="font-mono text-foreground">downsized 60% → 35%</span></span>
        <span>Exit policy: <span className="font-mono text-foreground">hard exit Wednesday close</span></span>
        <a href="#" className="font-mono text-[var(--neon-cyan)] underline-offset-4 hover:underline">arc tx · 0x09da…0818 ↗</a>
      </div>
    </div>
  );
}

function SynthCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-black px-4 py-3">
      <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-foreground/65">{label}</div>
      <div className={`mt-1 text-foreground ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

export function PanelDebate() {
  const [active, setActive] = useState<TabId>("round-1");

  return (
    <section
      aria-labelledby="debate-heading"
      className="border-b border-[var(--hairline-strong)] bg-black"
    >
      <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
        <header className="mb-10">
          <div className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--neon-cyan)]">
            // sample debate · cycle 0x4f7c…a812
          </div>
          <h2
            id="debate-heading"
            className="mt-3 text-3xl font-bold leading-[1.1] tracking-tight text-balance sm:text-4xl md:text-5xl"
          >
            This is what they argue about.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-foreground/75">
            One real trade, debated across two rounds. Round two forces each reviewer to attack the strongest dissent. The synthesis is what gets anchored on Arc.
          </p>
        </header>

        {/* Trade context */}
        <div className="mb-4 grid grid-cols-2 gap-px border border-[var(--hairline-strong)] bg-[var(--hairline)] text-sm sm:grid-cols-4">
          <SynthCell label="Signal" value="yield_window" mono />
          <SynthCell label="Expected PnL" value="+4.8%" mono />
          <div className="col-span-2 bg-black px-4 py-3">
            <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-foreground/65">Proposal</div>
            <div className="mt-1 text-foreground">rotate 60% USDC → PT-eUSDe (Pendle, 21d expiry)</div>
          </div>
        </div>

        {/* Tabs */}
        <div role="tablist" aria-label="Debate rounds" className="flex flex-wrap gap-px border border-[var(--hairline-strong)] bg-[var(--hairline)]">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={active === t.id}
              aria-controls={`panel-${t.id}`}
              id={`tab-${t.id}`}
              onClick={() => setActive(t.id)}
              className={`flex-1 px-4 py-3 text-left font-mono text-[11px] uppercase tracking-[0.12em] transition-colors ${
                active === t.id
                  ? "bg-black text-[var(--neon-cyan)]"
                  : "bg-[#080808] text-foreground/70 hover:text-foreground"
              }`}
            >
              <span aria-hidden className="opacity-60">[ </span>
              {t.label}
              <span aria-hidden className="opacity-60"> ]</span>
            </button>
          ))}
        </div>

        {/* Active panel */}
        <div
          role="tabpanel"
          id={`panel-${active}`}
          aria-labelledby={`tab-${active}`}
          className="border border-t-0 border-[var(--hairline-strong)] bg-black px-5 py-2 sm:px-6"
        >
          {active === "round-1" && ROUND_1.map((l, i) => <LineRow key={i} line={l} />)}
          {active === "round-2" && ROUND_2.map((l, i) => <LineRow key={i} line={l} />)}
          {active === "synthesis" && <div className="py-6"><Synthesis /></div>}
        </div>
      </div>
    </section>
  );
}
