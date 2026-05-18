"use client";

import { DailyPlanBody, type PlanJson } from "./daily-plan-body";
import { ArcTxLink } from "@/components/ui/arc-tx-link";

export type BacktestPlan = {
  id: string;
  generatedAt: string;
  status: string;
  planMarkdown: string | null;
  planJson: PlanJson | null;
  errorMessage: string | null;
  arcAnchorTx: string | null;
  arcOnchainTxHash: string | null;
};

/**
 * Collapsible plans list for the backtest run detail view. Open state is
 * controlled by the parent so live-mode can force-expand without snapping
 * the panel shut the moment the run finishes.
 */
export function BacktestPlansList({
  plans,
  open,
  onOpenChange,
}: {
  plans: BacktestPlan[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <details
      open={open}
      onToggle={(e) => onOpenChange((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Daily analyses ({plans.length})
      </summary>
      <div className="mt-3 space-y-3">
        {plans.map((p) => (
          <div key={p.id} className="border border-[var(--neon-green)]/30 p-3">
            <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.16em]">
              <span className="text-[var(--neon-green)]">{p.generatedAt.slice(0, 10)}</span>
              <div className="flex items-center gap-3">
                <ArcTxLink hash={p.arcOnchainTxHash} queuedId={p.arcAnchorTx} label="anchor" />
                <span className={p.status === "failed" ? "text-[var(--neon-red)]" : "text-muted-foreground"}>{p.status}</span>
              </div>
            </header>
            {p.status === "failed" && p.errorMessage && (
              <p className="mt-2 font-mono text-xs text-[var(--neon-red)]">{p.errorMessage}</p>
            )}
            {p.status === "complete" && <DailyPlanBody planJson={p.planJson} planMarkdown={p.planMarkdown} />}
          </div>
        ))}
      </div>
    </details>
  );
}
