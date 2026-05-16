"use client";

import { useState } from "react";

export type SimParams = { entryConfidence: number; holdDays: number; sizeUsd: number };

const DEFAULTS: SimParams = { entryConfidence: 0.6, holdDays: 3, sizeUsd: 150 };

/**
 * Inline parameter sweep for the backtest trade simulator. Cheap to
 * re-run since simulation is a pure function of the LLM-generated
 * daily_plans (no new LLM calls), so an admin can tune the
 * entry-confidence / hold-days / size combo and see PnL move in
 * seconds.
 */
export function BacktestSimControls({ disabled, onSimulate }: {
  disabled: boolean;
  onSimulate: (params: SimParams) => void;
}) {
  const [entryConfidence, setEntry] = useState(DEFAULTS.entryConfidence);
  const [holdDays, setHold] = useState(DEFAULTS.holdDays);
  const [sizeUsd, setSize] = useState(DEFAULTS.sizeUsd);

  const fieldClass = "border border-[var(--neon-green)]/40 bg-black px-2 py-1 font-mono text-[11px] text-foreground disabled:opacity-60 w-20";
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        min conf
        <input
          type="number" step="0.05" min="0" max="1" value={entryConfidence}
          onChange={(e) => setEntry(Number(e.target.value))} disabled={disabled}
          className={fieldClass}
        />
      </label>
      <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        hold days
        <input
          type="number" step="1" min="1" max="30" value={holdDays}
          onChange={(e) => setHold(Math.floor(Number(e.target.value)))} disabled={disabled}
          className={fieldClass}
        />
      </label>
      <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        size $
        <input
          type="number" step="10" min="1" max="100000" value={sizeUsd}
          onChange={(e) => setSize(Number(e.target.value))} disabled={disabled}
          className={fieldClass}
        />
      </label>
      <button
        onClick={() => onSimulate({ entryConfidence, holdDays, sizeUsd })}
        disabled={disabled}
        className="border border-[var(--neon-green)] bg-black px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--neon-green)] hover:bg-[var(--neon-green)] hover:text-black disabled:opacity-60"
      >
        {disabled ? "simulating..." : "simulate"}
      </button>
    </div>
  );
}
