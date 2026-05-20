"use client";

type DecisionReport = {
  reason?: string;
  marketTrigger?: string;
  externalPressure?: string;
  confidence?: number;
  stopLossPriceUsd?: number | null;
  takeProfitPriceUsd?: number | null;
  blockedReasons?: string[];
};

function num(v: number | null | undefined, dp = 2): string | null {
  return typeof v === "number" && Number.isFinite(v) ? v.toFixed(dp) : null;
}

/**
 * The "why" behind one trade: the watcher's recorded decisionReport.
 * Shows the plain-English brief plus the structured signals (setup,
 * external pressure, confidence, stop/tp) and any blocked reasons.
 * Purely presentational; data is already on the trade row.
 */
export function TradeReasonDetail({ report }: { report: Record<string, unknown> | null | undefined }) {
  const r = report as DecisionReport | null | undefined;
  if (!r || (!r.reason && !r.marketTrigger)) {
    return <p className="font-mono text-[10px] normal-case tracking-normal text-muted-foreground">No reasoning recorded for this trade.</p>;
  }
  const stop = num(r.stopLossPriceUsd);
  const tp = num(r.takeProfitPriceUsd);
  const conf = num(r.confidence);
  const chips = [
    r.marketTrigger && `setup: ${r.marketTrigger}`,
    r.externalPressure && `pressure: ${r.externalPressure}`,
    conf && `conf: ${conf}`,
    stop && `stop: ${stop}`,
    tp && `tp: ${tp}`,
  ].filter(Boolean) as string[];
  return (
    <div className="space-y-2 normal-case tracking-normal">
      {r.reason && <p className="font-mono text-[11px] leading-relaxed text-foreground">{r.reason}</p>}
      <div className="flex flex-wrap gap-1">
        {chips.map((c) => (
          <span key={c} className="border border-[var(--neon-green)]/25 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">{c}</span>
        ))}
      </div>
      {r.blockedReasons && r.blockedReasons.length > 0 && (
        <p className="font-mono text-[9px] text-[var(--neon-red)]">blocked: {r.blockedReasons.join(", ")}</p>
      )}
    </div>
  );
}
