"use client";

type ControlState = {
  abort: () => void;
  resume: () => void;
  aborting: boolean;
  resuming: boolean;
};

const BTN = "border border-[var(--neon-green)] bg-black px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--neon-green)] hover:bg-[var(--neon-green)] hover:text-black disabled:opacity-60";
const DESTRUCTIVE = "border border-[var(--neon-red)] bg-black px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--neon-red)] hover:bg-[var(--neon-red)] hover:text-black disabled:opacity-60";

const STATUS_TONE: Record<string, string> = {
  running: "border-[var(--neon-cyan)] text-[var(--neon-cyan)]",
  completed: "border-[var(--neon-green)] text-[var(--neon-green)]",
  failed: "border-[var(--neon-red)] text-[var(--neon-red)]",
};

/**
 * Header strip for the backtest run detail view. Shows the date range,
 * click-to-copy run ID, progress and status chips, status-aware
 * abort/resume buttons, and close. Trade simulation runs automatically
 * when a backtest completes, so there is no manual replay control.
 */
export function BacktestRunHeader({
  runId,
  label,
  status,
  progress,
  controls,
  onClose,
}: {
  runId: string;
  label: string;
  status: "running" | "completed" | "failed" | undefined;
  progress: { completed: number; total: number } | null;
  controls: ControlState;
  onClose: () => void;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--neon-green)]/40 px-4 py-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--neon-green)]">{label}</span>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(runId).catch(() => {})}
          title={`Click to copy ${runId}`}
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-[var(--neon-green)]"
        >
          id {runId.slice(0, 8)}
        </button>
        {progress && (
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {progress.completed}/{progress.total} cycles
          </span>
        )}
        {status && (
          <span className={`border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] ${STATUS_TONE[status]}`}>
            {status}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {status === "running" && (
          <button onClick={controls.abort} disabled={controls.aborting} className={DESTRUCTIVE}>
            {controls.aborting ? "aborting..." : "abort"}
          </button>
        )}
        {status === "failed" && (
          <button onClick={controls.resume} disabled={controls.resuming} className={BTN}>
            {controls.resuming ? "resuming..." : "resume"}
          </button>
        )}
        <button onClick={onClose} className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--neon-green)] hover:underline">
          close
        </button>
      </div>
    </header>
  );
}
