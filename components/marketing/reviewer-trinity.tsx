/**
 * Meet the Trade Review Council — three reviewer cards. Greek-mythology
 * names rendered in brutalist trader style. Hover: card border glows in
 * reviewer's accent color.
 */

type Reviewer = {
  id: string;
  name: string;
  role: string;
  concern: string;
  trackRecord: string;
  symbol: string;
  accentVar: string; // CSS custom-property name on root
};

const REVIEWERS: Reviewer[] = [
  {
    id: "hermes",
    name: "HERMES",
    role: "Macro · Market Regime",
    concern: "“Is this trade fighting the regime?”",
    trackRecord: "73% correct dissents",
    symbol: "☿",
    accentVar: "--neon-amber",
  },
  {
    id: "athena",
    name: "ATHENA",
    role: "Protocol Depth · Liquidity",
    concern: "“Is the venue safe and deep enough?”",
    trackRecord: "67% correct dissents",
    symbol: "Ψ",
    accentVar: "--neon-cyan",
  },
  {
    id: "cassandra",
    name: "CASSANDRA",
    role: "Risk · Tail Events",
    concern: "“What's the worst case if we're wrong?”",
    trackRecord: "81% correct dissents",
    symbol: "Ω",
    accentVar: "--neon-red",
  },
];

export function ReviewerTrinity() {
  return (
    <section className="border-b border-[var(--hairline-strong)] bg-black">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-[var(--neon-cyan)]">
              // The Trade Review Council
            </div>
            <h2 className="mt-3 text-3xl font-bold uppercase tracking-tight md:text-5xl">
              Three specialists. <br className="hidden sm:block" />
              One adversarial round.
            </h2>
          </div>
          <p className="max-w-md text-sm text-muted-foreground">
            Every Solon proposal is debated by three specialist reviewers,
            each on a different beat. Round two forces each to attack the
            strongest dissent before re-voting. Track records below are
            display-only — they don&apos;t override the panel.
          </p>
        </header>

        <div className="grid gap-px bg-[var(--hairline)] md:grid-cols-3">
          {REVIEWERS.map((r) => (
            <article
              key={r.id}
              className="group relative bg-black p-8 transition-shadow duration-300"
              style={{
                ["--reviewer-accent" as string]: `var(${r.accentVar})`,
              }}
            >
              <div
                className="absolute right-6 top-6 font-mono text-3xl opacity-40 transition-all duration-500 group-hover:scale-110 group-hover:opacity-100"
                style={{ color: `var(${r.accentVar})` }}
              >
                {r.symbol}
              </div>

              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Reviewer · {r.id}
              </div>
              <h3 className="mt-2 text-2xl font-bold uppercase tracking-tight">
                {r.name}
              </h3>
              <div
                className="mt-1 text-xs uppercase tracking-[0.2em]"
                style={{ color: `var(${r.accentVar})` }}
              >
                {r.role}
              </div>

              <p className="mt-6 text-sm italic text-foreground/80">
                {r.concern}
              </p>

              <div className="mt-8 flex items-center justify-between border-t border-[var(--hairline)] pt-4 text-[10px] uppercase tracking-[0.2em]">
                <span className="text-muted-foreground">Track record</span>
                <span style={{ color: `var(${r.accentVar})` }}>
                  {r.trackRecord}
                </span>
              </div>

              {/* hover glow */}
              <div
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  boxShadow: `inset 0 0 0 1px var(${r.accentVar}), 0 0 28px -8px var(${r.accentVar})`,
                }}
              />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
