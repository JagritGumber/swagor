/**
 * How Selbo learns from itself. Three terminal-output stages with mono
 * connector lines: a closed trade becomes a one-sentence lesson, that
 * lesson is fed into the next decision's context, capped to the most
 * recent 12. In-context evolution, no fine-tuning, no human in the loop.
 * The lesson body is a real example the live agent has produced.
 */

import { ArrowDown } from "lucide-react";

function Connector({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 px-1 py-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground" aria-hidden>
      <span className="h-px flex-1 bg-[var(--neon-cyan)]/30" />
      <ArrowDown className="h-3.5 w-3.5 text-[var(--neon-cyan)]/60" />
      <span className="text-[var(--neon-cyan)]/80">{text}</span>
      <span className="h-px flex-1 bg-[var(--neon-cyan)]/30" />
    </div>
  );
}

function StageHeader({ n, title }: { n: string; title: string }) {
  return (
    <div className="flex items-baseline gap-4">
      <span className="font-mono text-xl font-bold text-[var(--neon-cyan)]">{n}</span>
      <h3 className="text-lg font-bold uppercase leading-tight tracking-[0.05em] text-foreground">{title}</h3>
    </div>
  );
}

export function HowItLearns() {
  return (
    <section
      aria-labelledby="howitlearns-heading"
      className="cv-auto border-b border-[var(--hairline-strong)] bg-black"
    >
      <div className="mx-auto max-w-4xl px-6 py-14 sm:py-20">
        <header className="mb-12 max-w-3xl">
          <h2
            id="howitlearns-heading"
            className="text-[40px] font-bold uppercase leading-[1.05] tracking-tight text-balance text-foreground"
          >
            How it learns <span className="text-[var(--neon-cyan)]">from itself.</span>
          </h2>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">
            After every closed trade, Selbo extracts a one-sentence lesson tied to the entry thesis and the outcome. That lesson lives in the next decision&apos;s context. The agent literally reads what worked and what failed for it, before deciding again. No fine-tuning. No human in the loop.
          </p>
        </header>

        <article className="border border-[var(--hairline-strong)] bg-[#080808] p-6 sm:p-8" style={{ animation: "rise-in 0.7s cubic-bezier(0.16,1,0.3,1) 0ms both" }}>
          <StageHeader n="01" title="Trade closed" />
          <div className="mt-5">
            <div className="flex flex-wrap items-baseline gap-4 text-base">
              <span className="font-mono font-bold uppercase tracking-[0.18em] text-[var(--neon-red)]">SHORT ETH</span>
              <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">stop_loss</span>
              <span className="font-mono font-bold text-[var(--neon-red)] tabular-nums">-$2.86</span>
            </div>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              Entry rationale: <span className="text-foreground">&quot;Rejected above value, bearish trend, expecting breakdown.&quot;</span> Broke higher instead.
            </p>
          </div>
        </article>

        <Connector text="extracted by a light LLM" />

        <article className="border border-[var(--hairline-strong)] bg-[#080808] p-6 sm:p-8" style={{ animation: "rise-in 0.7s cubic-bezier(0.16,1,0.3,1) 120ms both" }}>
          <StageHeader n="02" title="Lesson" />
          <blockquote className="mt-5 border-l-2 border-[var(--neon-cyan)]/40 pl-4 text-lg leading-relaxed text-foreground">
            Shorted ETH expecting a breakdown after rejection above value; it broke higher instead. Do not short into resistance without confirmation.
          </blockquote>
        </article>

        <Connector text="carried into the next decision's context" />

        <article className="border border-[var(--hairline-strong)] bg-[#080808] p-6 sm:p-8" style={{ animation: "rise-in 0.7s cubic-bezier(0.16,1,0.3,1) 240ms both" }}>
          <StageHeader n="03" title="Next decision" />
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            The agent reads its <span className="text-foreground">12 most recent lessons</span> before opening any new position. No blind repeats of the setup that just failed. <span className="text-foreground">In-context, capped, fed forward</span> - no fine-tuning, no human in the loop.
          </p>
        </article>

        <p className="mt-12 text-center text-base leading-relaxed text-foreground/80">
          That is how the agent <span className="text-[var(--neon-cyan)]">stops repeating</span> the setups that already lost.
        </p>
      </div>
    </section>
  );
}
