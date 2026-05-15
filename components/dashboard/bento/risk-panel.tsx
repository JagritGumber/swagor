"use client";

import { useWatcherPoll } from "@/lib/utils/use-watcher-poll";

const STATUS_TONE: Record<string, { label: string; text: string; bg: string }> = {
  normal: { label: "Normal", text: "text-emerald-400", bg: "bg-emerald-500/10" },
  watch: { label: "Watch", text: "text-amber-300", bg: "bg-amber-500/10" },
  urgent: { label: "Urgent", text: "text-orange-400", bg: "bg-orange-500/10" },
  critical: { label: "Critical", text: "text-[var(--neon-red)]", bg: "bg-[var(--neon-red)]/10" },
};

// Dummy risk so the side panel shape is visible without real ticks.
// Remove the fallback when the watcher has been writing context.
const DUMMY = {
  status: "normal" as const,
  closestLiquidationDistancePct: 12.4,
  account: { marginUsagePct: 18 },
  totalExposureUsd: 0,
};

/**
 * Narrow vertical risk side panel. Lives to the right of the price
 * chart in the top bento row. Compact stack: status badge, liq buffer,
 * margin usage. Falls back to dummy values when no watcher tick has
 * written context yet.
 */
export function RiskPanel() {
  const data = useWatcherPoll({ limit: 1 });
  const real = data?.ticks[0]?.context?.risk;
  const isDummy = !real;
  const risk = real ?? DUMMY;
  const tone = STATUS_TONE[risk.status] ?? STATUS_TONE.normal!;

  return (
    <section className="flex h-full flex-col border border-[var(--hairline-strong)] bg-black p-4">
      <header className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Risk
        </span>
        {isDummy && (
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground/60">
            dummy
          </span>
        )}
      </header>
      <div className={`mt-2 inline-block w-fit border px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.16em] ${tone.text} ${tone.bg}`}>
        {tone.label}
      </div>

      <dl className="mt-4 space-y-3 font-mono text-[11px]">
        <div>
          <dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Liq buffer
          </dt>
          <dd className="mt-0.5 text-base tabular-nums text-foreground">
            {risk.closestLiquidationDistancePct === null || risk.closestLiquidationDistancePct === undefined
              ? "n/a"
              : `${risk.closestLiquidationDistancePct.toFixed(1)}%`}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Margin used
          </dt>
          <dd className="mt-0.5 text-base tabular-nums text-foreground">
            {risk.account?.marginUsagePct === null || risk.account?.marginUsagePct === undefined
              ? "n/a"
              : `${risk.account.marginUsagePct.toFixed(1)}%`}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Exposure
          </dt>
          <dd className="mt-0.5 text-base tabular-nums text-foreground">
            ${risk.totalExposureUsd?.toFixed(0) ?? "0"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
