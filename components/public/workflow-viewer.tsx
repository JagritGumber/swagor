"use client";

import { useEffect, useState } from "react";
import { CycleWorkflow } from "@/components/dashboard/bento/cycle-workflow";
import { deriveStages, type CallRow, type PlanRow } from "@/components/dashboard/bento/cycle-stages";

type Resp = {
  cycle: { id: string; status: string; createdAt: string; completedAt: string | null; errorMessage: string | null } | null;
  calls: CallRow[];
  plan: PlanRow;
};

function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/**
 * The brain: Selbo's most recent decision cycle rendered as a workflow
 * pipeline (start -> context -> swarm/6 personas -> aggregate -> compile ->
 * anchor on Arc) via the shared CycleWorkflow. Polls the public workflow
 * endpoint and derives stages client-side. No reasoning corpus -- structure,
 * persona count, timing, and anchor status only.
 */
export function WorkflowViewer({ username }: { username: string }) {
  const [data, setData] = useState<Resp | null>(null);

  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      try {
        const res = await fetch(`/api/public/selbo/${encodeURIComponent(username)}/workflow`, { cache: "no-store" });
        if (res.ok && !cancelled) setData((await res.json()) as Resp);
      } catch {
        /* transient; next interval retries */
      }
    };
    pull();
    const id = setInterval(pull, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [username]);

  const cycle = data?.cycle;
  return (
    <section className="bg-black">
      <header className="flex items-baseline justify-between gap-3 px-4 pt-4 font-mono text-[10px] uppercase tracking-[0.18em]">
        <span className="text-[var(--neon-cyan)]">Workflow</span>
        <span className="text-muted-foreground">{cycle ? `last decision ${ago(cycle.createdAt)}` : ""}</span>
      </header>
      {!cycle ? (
        <p className="px-4 py-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          No analysis cycle yet. Selbo convenes its panel when the market warrants it.
        </p>
      ) : (
        <CycleWorkflow
          stages={deriveStages(
            { id: cycle.id, asOf: null, status: cycle.status, createdAt: cycle.createdAt, completedAt: cycle.completedAt, errorMessage: cycle.errorMessage },
            data!.calls,
            data!.plan,
          )}
        />
      )}
    </section>
  );
}
