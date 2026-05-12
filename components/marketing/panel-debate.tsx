/**
 * Scrubable sample debate.
 *
 * Tab borders frame the active tab: side borders point toward the active
 * tab from adjacent ones. Round 01 active = bottom + right cyan; Round 02
 * active = bottom + left + right; The call active = bottom + left.
 *
 * CallView rewritten to be less bold + less "majority wins" framing.
 * Label/value rows replace the wide table to remove empty space.
 */

"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import {
  ANALYSTS,
  SAMPLE_CYCLE,
  SAMPLE_ROUND_ONE,
  SAMPLE_ROUND_TWO,
  VERDICT_GLYPH,
  VERDICT_LABEL,
} from "@/lib/marketing-data";

const ANALYST_NAMES = Object.fromEntries(ANALYSTS.map((a) => [a.id, a.name]));

type TabId = "one" | "two" | "call";
const TABS: { id: TabId; label: string; sub: string }[] = [
  { id: "one", label: "Round 01", sub: "independent reads" },
  { id: "two", label: "Round 02", sub: "the adversarial round" },
  { id: "call", label: "The call", sub: "what got recorded" },
];

function Line({
  who,
  verdict,
  text,
}: {
  who: string;
  verdict: keyof typeof VERDICT_LABEL;
  text: string;
}) {
  return (
    <div className="grid gap-3 border-b border-[var(--hairline)] py-7 last:border-b-0 sm:grid-cols-[200px_1fr] sm:gap-10">
      <div>
        <div className="text-xl font-bold uppercase leading-tight text-foreground">
          {ANALYST_NAMES[who]}
        </div>
        <div className="mt-2 inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <span aria-hidden className="text-[var(--neon-cyan)]">{VERDICT_GLYPH[verdict]}</span>
          <span>{VERDICT_LABEL[verdict]}</span>
        </div>
      </div>
      <p className="text-base leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

function CallView() {
  const rows = [
    { label: "Final size", value: SAMPLE_CYCLE.finalSize, link: false },
    { label: "Exit policy", value: SAMPLE_CYCLE.exitPolicy, link: false },
    { label: "Recorded on Arc", value: SAMPLE_CYCLE.arcTx, link: true },
  ];
  return (
    <div className="space-y-6 py-6">
      <p className="text-lg leading-relaxed text-muted-foreground">
        The panel split two-to-one. <span className="text-foreground">Solon went forward with a smaller position</span>, downsized to thirty-five percent, with a hard exit at Wednesday close. The Skeptic&apos;s reject was preserved on-chain alongside the trade.
      </p>

      <div className="grid grid-cols-2 gap-px border border-[var(--hairline-strong)] bg-[var(--hairline-strong)] sm:grid-cols-3">
        <SynthCell label="Outcome" value={VERDICT_LABEL["approve_with_note"]} />
        <SynthCell label="Vote" value="2 to 1" />
        <SynthCell label="Dissent" value={`${ANALYST_NAMES["skeptic"]} · tail risk`} />
      </div>

      <dl className="divide-y divide-[var(--hairline)] border-y border-[var(--hairline-strong)]">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[180px_1fr] items-baseline gap-6 py-3 sm:grid-cols-[220px_1fr]">
            <dt className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {r.label}
            </dt>
            <dd className="text-base text-foreground">
              {r.link ? (
                <a
                  href="https://testnet.arcscan.app"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono text-[var(--neon-cyan)] underline-offset-4 hover:underline"
                >
                  {r.value}
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </a>
              ) : (
                r.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SynthCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-black px-5 py-4">
      <div className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-base font-bold uppercase text-foreground">{value}</div>
    </div>
  );
}

function tabBorderClass(active: boolean, id: TabId) {
  if (!active) return "border-transparent";
  // Active tab: bottom always cyan; side borders frame toward adjacent tabs.
  if (id === "one") return "border-b-[var(--neon-cyan)] border-r-[var(--neon-cyan)]";
  if (id === "two") return "border-b-[var(--neon-cyan)] border-l-[var(--neon-cyan)] border-r-[var(--neon-cyan)]";
  return "border-b-[var(--neon-cyan)] border-l-[var(--neon-cyan)]";
}

export function PanelDebate() {
  const [active, setActive] = useState<TabId>("one");

  return (
    <section
      aria-labelledby="debate-heading"
      className="border-b border-[var(--hairline-strong)] bg-black"
    >
      <div className="mx-auto max-w-5xl px-6 py-14 sm:py-20">
        <header className="mb-10 max-w-3xl">
          <h2
            id="debate-heading"
            className="text-[40px] font-bold uppercase leading-[1.05] tracking-tight text-balance text-foreground"
          >
            One trade. <span className="text-[var(--neon-cyan)]">Two rounds.</span>
          </h2>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">
            The same trade, debated independently, then again adversarially. Read it the way you would read a memo from three desks that do not fully agree.
          </p>
        </header>

        <div className="mb-8 grid gap-6 border border-[var(--hairline-strong)] bg-[#080808] p-6 sm:grid-cols-[1fr_auto]">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Signal · cycle {SAMPLE_CYCLE.id}
            </div>
            <p className="mt-3 text-xl leading-tight text-foreground">
              {SAMPLE_CYCLE.signal} {SAMPLE_CYCLE.proposalPlain}
            </p>
          </div>
          <div className="sm:text-right">
            <div className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Expected leg
            </div>
            <div className="mt-2 text-[28px] font-bold text-[var(--neon-green)]">
              {SAMPLE_CYCLE.expectedPctPlain}
            </div>
          </div>
        </div>

        <div role="tablist" aria-label="Debate rounds" className="flex flex-wrap divide-x divide-[var(--hairline-strong)] border-x border-t border-[var(--hairline-strong)]">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={active === t.id}
              aria-controls={`debate-panel-${t.id}`}
              id={`debate-tab-${t.id}`}
              onClick={() => setActive(t.id)}
              className={`flex-1 border-b-2 border-l-2 border-r-2 px-6 py-5 text-left transition-all duration-300 ${
                active === t.id ? "bg-black" : "bg-[#080808] hover:bg-[#101010]"
              } ${tabBorderClass(active === t.id, t.id)}`}
            >
              <div className={`text-xl font-bold uppercase leading-tight ${active === t.id ? "text-foreground" : "text-muted-foreground"}`}>
                {t.label}
              </div>
              <div className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
                {t.sub}
              </div>
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`debate-panel-${active}`}
          aria-labelledby={`debate-tab-${active}`}
          className="border-x border-b border-[var(--hairline-strong)] bg-black px-6 sm:px-10"
          key={active}
          style={{ animation: "rise-in 0.4s ease-out both" }}
        >
          {active === "one" && SAMPLE_ROUND_ONE.map((l, i) => <Line key={i} {...l} />)}
          {active === "two" && SAMPLE_ROUND_TWO.map((l, i) => <Line key={i} {...l} />)}
          {active === "call" && <CallView />}
        </div>
      </div>
    </section>
  );
}
