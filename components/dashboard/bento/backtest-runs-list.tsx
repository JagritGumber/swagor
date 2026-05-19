"use client";

import { useEffect, useState } from "react";

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
  plannerPromptVersion: string | null;
};

const PAGE_SIZE = 5;

function statusTone(status: string): string {
  if (status === "failed") return "text-[var(--neon-red)]";
  if (status === "completed") return "text-[var(--neon-green)]";
  return "text-[var(--neon-cyan)]";
}

function logRunError(run: BacktestRunRow): void {
  if (!run.errorMessage) return;
  console.groupCollapsed(`[Selbo backtest error] ${run.startDate} to ${run.endDate} (${run.id.slice(0, 8)})`);
  console.error(run.errorMessage);
  console.info({ runId: run.id, status: run.status, cyclesCompleted: run.cyclesCompleted, cyclesRequested: run.cyclesRequested });
  console.groupEnd();
}

export function BacktestRunsList({ runs, activeId, onSelect }: {
  runs: BacktestRunRow[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [runs.length]);

  if (runs.length === 0) return null;

  const totalPages = Math.max(1, Math.ceil(runs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visible = runs.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="mt-3">
      <ul className="space-y-1">
        {visible.map((r) => {
          const isActive = r.id === activeId;
          return (
            <li key={r.id}>
              <button
                onClick={() => {
                  logRunError(r);
                  onSelect(isActive ? null : r.id);
                }}
                className={`flex w-full flex-wrap items-center gap-x-4 gap-y-1 border px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.14em] ${
                  isActive ? "border-[var(--neon-green)] bg-[var(--neon-green)]/10" : "border-[var(--neon-green)]/30 hover:border-[var(--neon-green)]"
                }`}
              >
                <span className="text-foreground">{r.startDate} to {r.endDate}</span>
                <span className="text-muted-foreground">{r.cyclesCompleted}/{r.cyclesRequested}</span>
                <span className={statusTone(r.status)}>{r.status}</span>
                {r.plannerPromptVersion && <span className="border border-[var(--neon-cyan)]/40 px-1.5 py-0.5 text-[var(--neon-cyan)]">{r.plannerPromptVersion}</span>}
                {r.errorMessage && <span className="text-[var(--neon-red)]" title={r.errorMessage}>click for console</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {totalPages > 1 && (
        <div className="mt-2 flex items-center justify-end gap-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="border border-[var(--neon-green)]/30 px-2 py-0.5 text-[var(--neon-green)] hover:border-[var(--neon-green)] disabled:opacity-40"
          >prev</button>
          <span>page {safePage + 1} of {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            className="border border-[var(--neon-green)]/30 px-2 py-0.5 text-[var(--neon-green)] hover:border-[var(--neon-green)] disabled:opacity-40"
          >next</button>
        </div>
      )}
    </div>
  );
}
