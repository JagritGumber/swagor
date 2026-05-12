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
    name: "Hermes",
    role: "Macro · Regime",
    concern: "Watches the macro tape. Asks: are we trading with the regime or against it?",
    trackRecord: "73% correct dissents · last 30d",
    symbol: "☿",
    accentVar: "--neon-cyan",
  },
  {
    id: "athena",
    name: "Athena",
    role: "Protocol · Liquidity",
    concern: "Watches protocols and pool depth. Asks: can the venue absorb this trade without slipping?",
    trackRecord: "67% correct dissents · last 30d",
    symbol: "Ψ",
    accentVar: "--neon-cyan",
  },
  {
    id: "cassandra",
    name: "Cassandra",
    role: "Risk · Tail",
    concern: "Watches what nobody wants to. Asks: what breaks if we are wrong about everything?",
    trackRecord: "81% correct dissents · last 30d",
    symbol: "Ω",
    accentVar: "--neon-cyan",
  },
];

export function ReviewerTrinity() {
  return (
    <section className="border-b border-[var(--hairline-strong)] bg-black">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <header className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--neon-cyan)] sm:text-xs">
              // The Trade Review Council
            </div>
            <h2 className="mt-3 text-3xl font-bold uppercase leading-[1.05] tracking-tight text-balance sm:text-4xl md:text-5xl">
              Three agents debate. <br className="hidden sm:block" />
              One round is adversarial.
            </h2>
          </div>
          <p className="max-w-md text-sm text-muted-foreground">
            Every Solon proposal hits the council. Round two forces each
            reviewer to attack the strongest dissent before re-voting.
            Track records are display-only — they never override the panel.
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
