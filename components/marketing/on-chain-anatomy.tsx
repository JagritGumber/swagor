/**
 * What every Selbo decision looks like on Arc: the DecisionAnchored event
 * shape + the source-verified contract that emits it. Field values are
 * illustrative; the contract address is real and clickable on Arcscan.
 * Aesthetic: blockchain-inspector data sheet, mono, hairlines, sharp.
 */

import type { ReactNode } from "react";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";

const ANCHOR_FIELDS: Array<{ label: string; value: ReactNode }> = [
  { label: "portfolio", value: "0xeb0d...fb04" },
  { label: "cycleId", value: "0x4f7c...a812" },
  { label: "reasoningHash", value: "0x9b3a...c5d1" },
  {
    label: "verdict",
    value: (
      <>
        <span className="text-foreground">SHORT ETH stop_loss</span>{" "}
        <span className="text-[var(--neon-red)]">-2.86%</span>
      </>
    ),
  },
  { label: "anchoredAt", value: "2026-05-23 14:21:08 UTC" },
];

const CONTRACT_ADDRESS = "0x12a93ad9a7d3d9ad3d51aa4c38953742c9e1eff2";
const ARCSCAN = `https://testnet.arcscan.app/address/${CONTRACT_ADDRESS}?tab=contract`;

export function OnChainAnatomy() {
  return (
    <section
      aria-labelledby="onchain-heading"
      className="cv-auto border-b border-[var(--hairline-strong)] bg-black"
    >
      <div className="mx-auto max-w-4xl px-6 py-14 sm:py-20">
        <header className="mb-12 max-w-3xl">
          <h2
            id="onchain-heading"
            className="text-[40px] font-bold uppercase leading-[1.05] tracking-tight text-balance text-foreground"
          >
            Every move, <span className="text-[var(--neon-cyan)]">on the record.</span>
          </h2>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">
            Every Selbo decision lands on Arc as a permanent on-chain event. The shape below is what the contract emits. Values are illustrative; the contract address is real and source-verified - click through and read the Solidity yourself.
          </p>
        </header>

        <div
          className="border border-[var(--hairline-strong)] bg-[#080808] font-mono"
          style={{ animation: "rise-in 0.7s cubic-bezier(0.16,1,0.3,1) 0ms both" }}
        >
          <div className="flex items-baseline justify-between border-b border-[var(--hairline-strong)] px-6 py-4">
            <div className="flex items-baseline gap-3">
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">event</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/50">example shape</span>
            </div>
            <span className="text-base font-bold tracking-[0.02em] text-[var(--neon-cyan)]">DecisionAnchored</span>
          </div>
          <dl className="divide-y divide-[var(--hairline)]">
            {ANCHOR_FIELDS.map((f) => (
              <div key={f.label} className="grid grid-cols-[140px_1fr] items-baseline gap-6 px-6 py-3 sm:grid-cols-[180px_1fr]">
                <dt className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{f.label}</dt>
                <dd className="break-all text-sm text-foreground/80">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div
          className="mt-8 border border-[var(--hairline-strong)] bg-black p-6 sm:p-8"
          style={{ animation: "rise-in 0.7s cubic-bezier(0.16,1,0.3,1) 140ms both" }}
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex items-center gap-2">
              <CheckCircle2 aria-hidden className="h-4 w-4 text-[var(--neon-green)]" />
              <span className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[var(--neon-green)]">
                Source-verified on Arcscan
              </span>
            </div>
            <a
              href={ARCSCAN}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-baseline gap-2 font-mono text-sm text-[var(--neon-cyan)] underline-offset-4 hover:underline sm:text-base"
            >
              <span className="break-all">{CONTRACT_ADDRESS}</span>
              <ArrowUpRight aria-hidden className="h-3.5 w-3.5 opacity-70" />
            </a>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Click through to read the Solidity that emits every DecisionAnchored event. No hidden logic, no privileged callers, no upgradeability switch you have to trust.
            </p>
          </div>
        </div>

        <p className="mt-10 text-center text-base leading-relaxed text-foreground/80">
          The reasoning is bound by hash to the on-chain record. <span className="text-[var(--neon-cyan)]">The agent cannot revise what it did after the fact.</span>
        </p>
      </div>
    </section>
  );
}
