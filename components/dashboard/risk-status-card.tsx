"use client";

import { useWatcherPoll, type WatcherRiskSnapshot } from "@/lib/utils/use-watcher-poll";

const STATUS_STYLE: Record<
  WatcherRiskSnapshot["status"],
  { label: string; text: string; border: string; bg: string }
> = {
  normal: {
    label: "Normal",
    text: "text-emerald-400",
    border: "border-emerald-400/40",
    bg: "bg-emerald-500/10",
  },
  watch: {
    label: "Watch",
    text: "text-amber-300",
    border: "border-amber-300/40",
    bg: "bg-amber-500/10",
  },
  urgent: {
    label: "Urgent",
    text: "text-orange-400",
    border: "border-orange-400/40",
    bg: "bg-orange-500/10",
  },
  critical: {
    label: "Critical",
    text: "text-[var(--neon-red)]",
    border: "border-[var(--neon-red)]/50",
    bg: "bg-[var(--neon-red)]/10",
  },
};

const VERDICT_LABEL: Record<string, string> = {
  hold: "Holding",
  execute: "Acting",
  deliberate: "Deliberating",
  risk_emergency: "Protecting",
  escalate: "Escalating",
};

function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "n/a";
  return `$${n.toFixed(2)}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "n/a";
  return `${n.toFixed(2)}%`;
}

/**
 * Risk-first hero card on the dashboard. Reads the latest watcher tick's
 * stored risk snapshot. Polls the same endpoint as WatchingStrip so both
 * stay in sync (cheap; cadence-aware).
 */
export function RiskStatusCard() {
  const data = useWatcherPoll({ limit: 1 });
  const latest = data?.ticks[0];
  const risk = latest?.context?.risk;
  const status = risk?.status ?? "normal";
  const style = STATUS_STYLE[status];

  return (
    <section className={`border ${style.border} ${style.bg} p-6`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Risk
          </div>
          <div className={`mt-1 text-3xl font-bold uppercase leading-none ${style.text}`}>
            {style.label}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Open exposure
          </div>
          <div className="mt-1 font-mono text-2xl tabular-nums text-foreground">
            {fmtUsd(risk?.totalExposureUsd ?? 0)}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Closest liquidation
          </div>
          <div className="mt-1 font-mono text-base tabular-nums text-foreground">
            {fmtPct(risk?.closestLiquidationDistancePct)}
            <span className="ml-1 text-xs text-muted-foreground">away</span>
          </div>
        </div>
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Latest decision
          </div>
          <div className="mt-1 text-sm leading-snug text-foreground">
            {latest ? (
              <>
                <span className="font-mono uppercase tracking-[0.14em] text-muted-foreground">
                  {VERDICT_LABEL[latest.verdict] ?? latest.verdict}
                </span>
                <span className="mx-1.5 text-muted-foreground">·</span>
                <span className="text-foreground">{latest.rationale}</span>
              </>
            ) : (
              <span className="text-muted-foreground">no ticks yet</span>
            )}
          </div>
        </div>
      </div>

      {risk?.summary && status !== "normal" && (
        <p className={`mt-5 border-t ${style.border} pt-4 text-sm ${style.text}`}>
          {risk.summary}
        </p>
      )}
    </section>
  );
}
