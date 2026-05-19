"use client";

type ErrorCycle = {
  id: string;
  asOf: string | null;
  status: string;
  errorMessage: string | null;
};

function formatError(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export function BacktestErrorConsole({ cycles }: { cycles: ErrorCycle[] }) {
  const failed = cycles.filter((cycle) => cycle.errorMessage);
  if (failed.length === 0) return null;

  return (
    <section className="border border-[var(--neon-red)]/60 bg-[#070101] font-mono">
      <div className="flex items-center justify-between border-b border-[var(--neon-red)]/30 px-3 py-2 text-[10px] uppercase tracking-[0.18em]">
        <span className="text-[var(--neon-red)]">error console</span>
        <span className="text-muted-foreground">{failed.length} cycle{failed.length === 1 ? "" : "s"}</span>
      </div>
      <div className="max-h-80 space-y-2 overflow-auto p-3">
        {failed.map((cycle) => (
          <article key={cycle.id} className="border border-[var(--neon-red)]/25 bg-black/40">
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--neon-red)]/20 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <span className="text-foreground">{cycle.asOf ? cycle.asOf.slice(0, 10) : "cycle"}</span>
              <span>{cycle.status}</span>
              <span>{cycle.id.slice(0, 8)}</span>
            </div>
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words p-2 text-[10px] normal-case tracking-normal text-[var(--neon-red)]">{formatError(cycle.errorMessage ?? "")}</pre>
          </article>
        ))}
      </div>
    </section>
  );
}
