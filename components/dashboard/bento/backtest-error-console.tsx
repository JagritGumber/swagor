"use client";

import { useEffect, useRef } from "react";

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
  const logged = useRef(new Set<string>());
  const failed = cycles.filter((cycle) => cycle.errorMessage);
  useEffect(() => {
    for (const cycle of failed) {
      const key = `${cycle.id}:${cycle.errorMessage}`;
      if (!cycle.errorMessage || logged.current.has(key)) continue;
      logged.current.add(key);
      console.groupCollapsed(`[Selbo cycle error] ${cycle.asOf ? cycle.asOf.slice(0, 10) : cycle.id.slice(0, 8)}`);
      console.error(formatError(cycle.errorMessage));
      console.info({ cycleId: cycle.id, asOf: cycle.asOf, status: cycle.status });
      console.groupEnd();
    }
  }, [failed]);

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
