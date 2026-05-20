"use client";

import { useEffect, useRef, useState } from "react";
import { deriveStages, fmtMs, formatError, type CallRow, type CycleRow, type PlanRow } from "./cycle-stages";
import { CycleWorkflow } from "./cycle-workflow";

export function BacktestPipelineCycle({ cycle, calls, plan, isCurrent }: { cycle: CycleRow; calls: CallRow[]; plan: PlanRow; isCurrent: boolean }) {
  const [open, setOpen] = useState(isCurrent);
  const userTouched = useRef(false);
  useEffect(() => {
    if (isCurrent && !userTouched.current) setOpen(true);
  }, [isCurrent]);

  const stages = deriveStages(cycle, calls, plan);
  const totalMs = cycle.completedAt ? Date.parse(cycle.completedAt) - Date.parse(cycle.createdAt) : null;
  const tone = cycle.status === "failed" ? "border-[var(--neon-red)]/40 text-[var(--neon-red)]"
    : cycle.status === "completed" ? "border-[var(--neon-green)]/30 text-[var(--neon-green)]"
    : "border-[var(--neon-cyan)]/40 text-[var(--neon-cyan)]";
  const asOfStr = cycle.asOf ? cycle.asOf.slice(0, 10) : cycle.createdAt.slice(0, 10);

  return (
    <div className={`border ${tone} bg-[#050505]`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => { userTouched.current = true; setOpen((v) => !v); }}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.16em]"
      >
        <span className="text-foreground">{asOfStr}</span>
        <span className="opacity-80">{cycle.status} / {fmtMs(totalMs)}</span>
      </button>
      {cycle.errorMessage && (
        <pre className="mx-3 mb-2 max-h-40 overflow-auto whitespace-pre-wrap break-words border border-[var(--neon-red)]/25 bg-black/50 p-2 font-mono text-[10px] normal-case tracking-normal text-[var(--neon-red)]">{formatError(cycle.errorMessage)}</pre>
      )}
      {open && <CycleWorkflow stages={stages} />}
    </div>
  );
}
