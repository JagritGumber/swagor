"use client";

export type BacktestRunRow = {
  id: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  cyclesCompleted: number;
  cyclesFailed: number;
  cyclesRequested: number;
  errorMessage: string | null;
  createdAt: string;
};

function statusTone(status: string): string {
  if (status === "failed") return "text-[var(--neon-red)]";
  if (status === "completed") return "text-[var(--neon-green)]";
  return "text-[var(--neon-cyan)]";
}

export function BacktestRunsList({ runs }: { runs: BacktestRunRow[] }) {
  if (runs.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1">
      {runs.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border border-[var(--neon-green)]/30 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em]">
          <span className="text-foreground">{r.startDate} to {r.endDate}</span>
          <span className="text-muted-foreground">{r.cyclesCompleted}/{r.cyclesRequested}</span>
          <span className={statusTone(r.status)}>{r.status}</span>
          {r.errorMessage && <span className="text-[var(--neon-red)]">{r.errorMessage.slice(0, 60)}</span>}
        </li>
      ))}
    </ul>
  );
}
