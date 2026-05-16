"use client";

export type BiasEntry = {
  asset: string;
  bias: "long" | "short" | "avoid" | "neutral";
  confidence: number;
  reason: string;
};

export type PlanJson = {
  watchlist?: string[];
  biasByAsset?: BiasEntry[];
  riskCaps?: { maxLeverage: number; maxNotionalPctOfEquity: number };
  notes?: string;
  markdown?: string;
};

function biasTone(b: BiasEntry["bias"]): string {
  if (b === "long") return "border-[var(--neon-green)] text-[var(--neon-green)]";
  if (b === "short") return "border-[var(--neon-red)] text-[var(--neon-red)]";
  if (b === "avoid") return "border-[var(--neon-yellow)] text-[var(--neon-yellow)]";
  return "border-[var(--hairline-strong)] text-muted-foreground";
}

export function DailyPlanBody({ planJson, planMarkdown }: { planJson: PlanJson | null; planMarkdown: string | null }) {
  return (
    <div className="mt-4 space-y-4">
      {planJson?.biasByAsset && planJson.biasByAsset.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {planJson.biasByAsset.map((b) => (
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
      {planMarkdown && (
        <pre className="whitespace-pre-wrap border border-[var(--hairline)] bg-[#050505] p-4 text-sm leading-relaxed text-foreground">{planMarkdown}</pre>
      )}
    </div>
  );
}
