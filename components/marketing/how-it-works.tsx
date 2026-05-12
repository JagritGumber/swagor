/**
 * Two-stage cycle diagram, brutalist style. Six stages connected by hairline
 * arrows. The "active" stage indicator sweeps across via animation.
 */

type Stage = {
  num: string;
  label: string;
  detail: string;
  accent?: string;
};

const STAGES: Stage[] = [
  { num: "01", label: "Monitor tick", detail: "One light LLM call. Every 15 min. Logs no_signal 95% of the time." },
  { num: "02", label: "Signal fires", detail: "Real signal detected. Full trade pipeline boots." },
  { num: "03", label: "Solon proposes", detail: "Heavy-tier LLM drafts trade, venue, size, safety triggers." },
  { num: "04", label: "Council debates", detail: "Hermes, Athena, Cassandra. Round two attacks the dissent." },
  { num: "05", label: "Critic audits", detail: "DeepSeek R1 cross-model gate. Different lineage, different blind spots." },
  { num: "06", label: "Execute · anchor", detail: "Simulated on Uniswap pool spot. TradeAnchored event on Arc." },
];

export function HowItWorks() {
  return (
    <section className="border-b border-[var(--hairline-strong)] bg-black">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <header className="mb-12">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--neon-cyan)] sm:text-xs">
            // Two-stage cycle architecture
          </div>
          <h2 className="mt-3 text-3xl font-bold uppercase leading-[1.05] tracking-tight text-balance sm:text-4xl md:text-5xl">
            How one trade gets made.
          </h2>
          <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
            A cheap monitor tick runs every 15 minutes asking one question.
            95% of the time the answer is no, and the tick exits. Only when
            something real lands does the full debate pipeline boot.
            <span className="text-foreground"> ~25× cheaper</span> than calling the whole council on every tick.
          </p>
        </header>

        <ol className="grid gap-px bg-[var(--hairline)] sm:grid-cols-2 lg:grid-cols-3">
          {STAGES.map((s, i) => (
            <li
              key={s.num}
              className="group relative bg-black p-6 transition-colors duration-300 hover:bg-[#080808]"
            >
              <div className="flex items-baseline justify-between">
                <span
                  className="text-xs uppercase tracking-[0.25em]"
                  style={{ color: s.accent ?? "var(--neon-cyan)" }}
                >
                  Stage {s.num}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {i < STAGES.length - 1 ? "→" : "●"}
                </span>
              </div>
              <h3 className="mt-3 text-xl font-bold uppercase tracking-tight">
                {s.label}
              </h3>
              <p className="mt-2 text-xs text-muted-foreground">
                {s.detail}
              </p>
              {/* underline accent grows on hover */}
              <div
                className="absolute bottom-0 left-0 h-px w-0 transition-all duration-500 group-hover:w-full"
                style={{ background: s.accent ?? "var(--neon-cyan)" }}
              />
            </li>
          ))}
        </ol>

        {/* Cost callout */}
        <div className="mt-10 flex flex-col gap-4 border border-[var(--hairline-strong)] bg-black p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              // Cost per active user · per day
            </div>
            <div className="mt-2 text-2xl font-bold text-[var(--neon-green)] sm:text-3xl">
              ≈ $0.05
            </div>
          </div>
          <p className="max-w-md text-xs text-muted-foreground">
            Monitor runs on free-tier OpenRouter Nemotron Nano 9B. Trade
            cycles use GLM-4.7-FlashX + DeepSeek R1 for the cross-model
            audit. Sustainable at hackathon scale and beyond.
          </p>
        </div>
      </div>
    </section>
  );
}
