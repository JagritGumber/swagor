/**
 * How a Selbo decision happens. Five stages, the same ones the live
 * workflow viewer renders on the flagship - so what someone reads on
 * the landing matches the loop they see running on the dashboard.
 * Single agent, no panel, no auditor.
 */

import { Activity, Anchor, PenLine, Scan, Telescope, type LucideIcon } from "lucide-react";

type Stage = {
  title: string;
  body: string;
  Icon: LucideIcon;
};

const STAGES: Stage[] = [
  {
    title: "Watches the markets",
    body: "Selbo polls the perps it cares about on a cadence it picks for itself, anywhere from a couple of minutes to half an hour. Mark prices, funding, open interest, recent candles, where price sits relative to value. Most ticks find nothing worth doing and it logs them as such.",
    Icon: Scan,
  },
  {
    title: "Reads the setup",
    body: "When something looks real, Selbo reads the structure: value area, regime, recent candle shape, and lessons extracted from its own past closed trades. No hardcoded playbook, no preset rules. The agent forms its own thesis from what it sees.",
    Icon: Telescope,
  },
  {
    title: "Takes the decision",
    body: "One LLM call writes the entire move. Direction, size, leverage, stop, target, the plain-English reasoning, and how confident it is. The agent can also decide to do nothing - and most of the time that is exactly what it does.",
    Icon: PenLine,
  },
  {
    title: "Acts on it",
    body: "If it decides to trade, the order simulates against the live Hyperliquid testnet mark price. Paper mode for now, no real capital at risk. But the action and the Circle wallet that signs it are both real on-chain.",
    Icon: Activity,
  },
  {
    title: "Records the proof on-chain",
    body: "The decision plus a hash of the full reasoning is anchored on Arc from your Circle wallet, on a source-verified contract anyone can read. Open the transaction on Arcscan and the agent's own words are bound to the on-chain record. It cannot revise what it did after the fact.",
    Icon: Anchor,
  },
];

export function HowItWorks() {
  return (
    <section
      aria-labelledby="howitworks-heading"
      className="cv-auto border-b border-[var(--hairline-strong)] bg-black"
    >
      <div className="mx-auto max-w-6xl px-6 py-14 sm:py-20">
        <header className="mb-10 max-w-3xl">
          <h2
            id="howitworks-heading"
            className="text-[40px] font-bold uppercase leading-[1.05] tracking-tight text-balance text-foreground"
          >
            From a quiet scan, <span className="text-[var(--neon-cyan)]">to a permanent record.</span>
          </h2>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">
            Most ticks do nothing. That is the point. When the agent finds a setup worth taking, the whole loop runs in seconds and the proof ends up on-chain forever.
          </p>
        </header>

        <ol className="divide-y divide-[var(--hairline-strong)] border-y border-[var(--hairline-strong)]">
          {STAGES.map((s, i) => {
            const Icon = s.Icon;
            return (
              <li
                key={s.title}
                className="grid grid-cols-1 gap-4 py-5 sm:grid-cols-[56px_1.4fr_3fr] sm:items-center sm:gap-8 sm:py-6"
                style={{ animation: `rise-in 0.7s cubic-bezier(0.16,1,0.3,1) ${i * 70}ms both` }}
              >
                <div className="flex items-center">
                  <span className="flex h-10 w-10 items-center justify-center border border-[var(--hairline-strong)] bg-[#080808]">
                    <Icon className="h-5 w-5 text-[var(--neon-cyan)]" aria-hidden />
                  </span>
                </div>
                <h3 className="text-xl font-bold uppercase leading-tight text-foreground">
                  {s.title}
                </h3>
                <p className="text-base leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
