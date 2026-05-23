/**
 * What every Selbo decision looks like on Arc + the source-verified
 * contract that emits it. Vertical provenance flow: verified contract
 * up top, 'emits' connector, the actual event shape below. The contract
 * address is real and clickable; field values are illustrative of the
 * format. Aesthetic: blockchain-inspector data sheet, corner brackets,
 * pulsing live-dot, all inside the existing cyan/green/red/black palette.
 */

import type { ReactNode } from "react";
import { ArrowDown, ArrowUpRight } from "lucide-react";

const ANCHOR_FIELDS: Array<{ label: string; value: ReactNode }> = [
  { label: "portfolio", value: <span className="text-foreground/85">0xeb0d...fb04</span> },
  { label: "cycleId", value: <span className="text-foreground/85">0x4f7c...a812</span> },
  { label: "reasoningHash", value: <span className="text-foreground/85">0x9b3a...c5d1</span> },
  {
    label: "verdict",
    value: (
      <>
        <span className="text-foreground">SHORT ETH</span>{" "}
        <span className="text-muted-foreground">stop_loss</span>{" "}
        <span className="text-[var(--neon-red)]">-2.86%</span>
      </>
    ),
  },
  { label: "anchoredAt", value: <span className="text-foreground/85">2026-05-23 14:21:08 UTC</span> },
];

const CONTRACT_ADDRESS = "0x12a93ad9a7d3d9ad3d51aa4c38953742c9e1eff2";
const ARCSCAN = `https://testnet.arcscan.app/address/${CONTRACT_ADDRESS}?tab=contract`;

function CornerBrackets() {
  const c = "pointer-events-none absolute h-3 w-3 border-[var(--neon-cyan)]/50";
  return (
    <>
      <span aria-hidden className={`${c} left-3 top-3 border-l border-t`} />
      <span aria-hidden className={`${c} right-3 top-3 border-r border-t`} />
      <span aria-hidden className={`${c} bottom-3 left-3 border-b border-l`} />
      <span aria-hidden className={`${c} bottom-3 right-3 border-b border-r`} />
    </>
  );
}

export function OnChainAnatomy() {
  return (
    <section
      aria-labelledby="onchain-heading"
      className="scanlines cv-auto relative border-b border-[var(--hairline-strong)] bg-black"
    >
      <div className="relative z-10 mx-auto max-w-4xl px-6 py-14 sm:py-20">
        <header className="mb-12 max-w-3xl">
          <h2
            id="onchain-heading"
            className="text-[40px] font-bold uppercase leading-[1.05] tracking-tight text-balance text-foreground"
          >
            Every move, <span className="text-[var(--neon-cyan)]">on the record.</span>
          </h2>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">
            Every Selbo decision lands on Arc as a permanent on-chain event. The contract that records it is source-verified - click through and read the Solidity. Field values below are illustrative; the contract address is real.
          </p>
        </header>

        <article
          className="relative border border-[var(--hairline-strong)] bg-[#080808] p-6 sm:p-8"
          style={{ animation: "rise-in 0.7s cubic-bezier(0.16,1,0.3,1) 0ms both" }}
        >
          <CornerBrackets />
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">contract on arc testnet</span>
            <div className="flex items-center gap-1.5">
              <span aria-hidden className="relative inline-block h-2 w-2 bg-[var(--neon-green)]">
                <span aria-hidden className="absolute inset-0 animate-ping bg-[var(--neon-green)]" />
              </span>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--neon-green)]">source-verified</span>
            </div>
          </div>
          <a
            href={ARCSCAN}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-baseline gap-3 font-mono text-base font-bold text-[var(--neon-cyan)] underline-offset-4 hover:underline sm:text-lg"
          >
            <span className="break-all">{CONTRACT_ADDRESS}</span>
            <ArrowUpRight aria-hidden className="h-4 w-4 shrink-0 opacity-70" />
          </a>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
            <span className="font-mono text-foreground/80">PortfolioDecisions.sol</span> - anyone can read every line of the contract that emits the event below. No hidden logic, no privileged callers, no upgradeability switch you have to trust.
          </p>
        </article>

        <div className="my-4 flex items-center gap-3 px-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground" aria-hidden>
          <span className="h-px flex-1 bg-[var(--neon-cyan)]/30" />
          <ArrowDown className="h-3.5 w-3.5 text-[var(--neon-cyan)]/60" />
          <span className="text-[var(--neon-cyan)]/80">emits one event per decision</span>
          <span className="h-px flex-1 bg-[var(--neon-cyan)]/30" />
        </div>

        <article
          className="border border-[var(--hairline-strong)] bg-[#080808] font-mono"
          style={{ animation: "rise-in 0.7s cubic-bezier(0.16,1,0.3,1) 140ms both" }}
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
                <dd className="break-all text-sm">{f.value}</dd>
              </div>
            ))}
          </dl>
        </article>

        <p className="mt-12 text-center text-base leading-relaxed text-foreground/80">
          The reasoning is bound by hash to the on-chain record. <span className="text-[var(--neon-cyan)]">The agent cannot revise what it did after the fact.</span>
        </p>
      </div>
    </section>
  );
}
