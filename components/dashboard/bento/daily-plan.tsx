"use client";

import { useEffect, useState } from "react";

type BiasEntry = { asset: string; bias: "long" | "short" | "avoid" | "neutral"; confidence: number; reason: string };
type PlanJson = {
  watchlist?: string[];
  biasByAsset?: BiasEntry[];
  riskCaps?: { maxLeverage: number; maxNotionalPctOfEquity: number };
  notes?: string;
  markdown?: string;
};
type DailyPlanRow = {
  id: string;
  generatedAt: string;
  status: "pending" | "complete" | "failed";
  planMarkdown: string | null;
  planJson: PlanJson | null;
  errorMessage: string | null;
};

function biasTone(b: BiasEntry["bias"]): string {
  if (b === "long") return "border-[var(--neon-green)] text-[var(--neon-green)]";
  if (b === "short") return "border-[var(--neon-red)] text-[var(--neon-red)]";
  if (b === "avoid") return "border-[var(--neon-yellow)] text-[var(--neon-yellow)]";
  return "border-[var(--hairline-strong)] text-muted-foreground";
}

export function DailyPlan() {
  const [plan, setPlan] = useState<DailyPlanRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, []);

  return (
    <section className="border border-[var(--hairline-strong)] bg-black p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="flex items-baseline gap-3">
          <span aria-hidden className="inline-block h-2.5 w-2.5 bg-[var(--neon-cyan)]" />
          <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">Today&apos;s plan</h2>
        </div>
        {plan && (
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            generated {new Date(plan.generatedAt).toLocaleTimeString()}
          </div>
        )}
      </header>

      {loading && <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">loading...</p>}
      {error && <p className="mt-4 border border-[var(--neon-red)] bg-[#120707] p-3 font-mono text-xs uppercase tracking-[0.16em] text-[var(--neon-red)]">{error}</p>}

      {!loading && !error && !plan && (
        <p className="mt-4 border border-dashed border-[var(--hairline-strong)] bg-[#080808] p-4 text-sm text-muted-foreground">
          First daily plan generates at the next scheduled run (00:05 UTC). Once generated, it will appear here.
        </p>
      )}

      {plan?.status === "failed" && (
        <div className="mt-4 border border-[var(--neon-red)] bg-[#120707] p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--neon-red)]">plan generation failed</p>
          <p className="mt-2 text-sm text-foreground">{plan.errorMessage ?? "Unknown error"}</p>
        </div>
      )}

      {plan?.status === "complete" && plan.planJson && (
        <div className="mt-4 space-y-4">
          {plan.planJson.biasByAsset && plan.planJson.biasByAsset.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {plan.planJson.biasByAsset.map((b) => (
                <div key={b.asset} className={`border bg-[#050505] p-3 ${biasTone(b.bias)}`} title={b.reason}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[12px] font-bold uppercase tracking-[0.18em]">{b.asset}</span>
                    <span className="font-mono text-[10px] uppercase">{b.bias}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-foreground">{b.reason}</p>
                </div>
              ))}
            </div>
          )}
          {plan.planMarkdown && (
            <pre className="whitespace-pre-wrap border border-[var(--hairline)] bg-[#050505] p-4 text-sm leading-relaxed text-foreground">{plan.planMarkdown}</pre>
          )}
        </div>
      )}
    </section>
  );
}
