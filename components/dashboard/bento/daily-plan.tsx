"use client";

import { useEffect, useRef, useState } from "react";
import { DailyPlanBody, type PlanJson } from "./daily-plan-body";
import { ArcTxLink } from "@/components/ui/arc-tx-link";

type DailyPlanRow = {
  id: string;
  generatedAt: string;
  status: "pending" | "complete" | "failed";
  planMarkdown: string | null;
  planJson: PlanJson | null;
  errorMessage: string | null;
  arcAnchorTx: string | null;
  arcOnchainTxHash: string | null;
};

export function DailyPlan() {
  const [plan, setPlan] = useState<DailyPlanRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const planRef = useRef<DailyPlanRow | null>(null);
  planRef.current = plan;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/swarm/daily-plan/current", { cache: "no-store" });
        if (res.status === 404) { if (!cancelled) { setPlan(null); setLoading(false); } return; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json() as { plan: DailyPlanRow | null };
        if (!cancelled) { setPlan(body.plan); setLoading(false); setError(null); }
      } catch (err) {
        if (!cancelled) { setError(err instanceof Error ? err.message : String(err)); setLoading(false); }
      }
    }
    void load();
    // Poll every 8s while the plan is missing or still generating. Ref
    // read keeps the interval stable across plan updates.
    const timer = window.setInterval(() => {
      const p = planRef.current;
      if (!p || p.status !== "complete") void load();
    }, 8_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  return (
    <section className="border border-[var(--hairline-strong)] bg-black p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">Analysis</h2>
        {plan && (
          <div className="flex flex-wrap items-center gap-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <span>generated {new Date(plan.generatedAt).toLocaleTimeString()}</span>
            <ArcTxLink hash={plan.arcOnchainTxHash} queuedId={plan.arcAnchorTx} label="arc anchor" />
          </div>
        )}
      </header>

      {loading && <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">loading...</p>}
      {error && <p className="mt-4 border border-[var(--neon-red)] bg-[#120707] p-3 font-mono text-xs uppercase tracking-[0.16em] text-[var(--neon-red)]">{error}</p>}

      {!loading && !error && !plan && (
        <p className="mt-4 border border-dashed border-[var(--hairline-strong)] bg-[#080808] p-4 text-sm text-muted-foreground">
          Your first analysis is generating. This page will update automatically when it lands.
        </p>
      )}

      {plan?.status === "pending" && (
        <p className="mt-4 border border-dashed border-[var(--hairline-strong)] bg-[#080808] p-4 text-sm text-muted-foreground">
          Generating analysis. This page will update automatically.
        </p>
      )}

      {plan?.status === "failed" && (
        <div className="mt-4 border border-[var(--neon-red)] bg-[#120707] p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--neon-red)]">analysis generation failed</p>
          <p className="mt-2 text-sm text-foreground">{plan.errorMessage ?? "Unknown error"}</p>
        </div>
      )}

      {plan?.status === "complete" && <DailyPlanBody planJson={plan.planJson} planMarkdown={plan.planMarkdown} />}
    </section>
  );
}
