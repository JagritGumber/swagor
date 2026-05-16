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

export function BacktestRunsList({ runs, activeId, onSelect }: {
  runs: BacktestRunRow[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
}) {
  if (runs.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1">
      {runs.map((r) => {
        const isActive = r.id === activeId;
        return (
          <li key={r.id}>
            <button
              onClick={() => onSelect(isActive ? null : r.id)}
              className={`flex w-full flex-wrap items-center gap-x-4 gap-y-1 border px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.14em] ${
                isActive ? "border-[var(--neon-green)] bg-[var(--neon-green)]/10" : "border-[var(--neon-green)]/30 hover:border-[var(--neon-green)]"
              }`}
            >
              <span className="text-foreground">{r.startDate} to {r.endDate}</span>
              <span className="text-muted-foreground">{r.cyclesCompleted}/{r.cyclesRequested}</span>
              <span className={statusTone(r.status)}>{r.status}</span>
              {r.errorMessage && <span className="text-[var(--neon-red)]">{r.errorMessage.slice(0, 60)}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
