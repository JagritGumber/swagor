"use client";

import { useEffect, useState } from "react";
import { useWatcherPoll } from "@/lib/utils/use-watcher-poll";

type EquityRecent = {
  snapshots: Array<{ ts: string; equityUsd: number; openPositions: number }>;
  lifetime: { start: number | null; high: number | null; low: number | null };
};

const STATUS_TONE: Record<string, { label: string; text: string }> = {
  normal: { label: "Normal", text: "text-emerald-400" },
  watch: { label: "Watch", text: "text-amber-300" },
  urgent: { label: "Urgent", text: "text-orange-400" },
  critical: { label: "Critical", text: "text-[var(--neon-red)]" },
};

function fmtUsd(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "n/a";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "n/a";
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

/**
 * Compact balance + risk tile. Top: current equity USD + 24h delta or
 * "first snapshot N min ago" placeholder when there is only one row.
 * Bottom: risk status + closest liquidation buffer + margin usage from
 * the latest watcher tick. Replaces RiskStatusCard outright; no fallback.
 */
export function BalanceRisk() {
  const watcher = useWatcherPoll({ limit: 1 });
  const [equity, setEquity] = useState<EquityRecent | null>(null);

  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      try {
        const res = await fetch("/api/equity/recent?days=1", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as EquityRecent;
        if (!cancelled) setEquity(data);
      } catch {
        // swallow
      }
    };
    pull();
    const id = setInterval(pull, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const snaps = equity?.snapshots ?? [];
  const current = snaps[snaps.length - 1] ?? null;
  const earliest24h = snaps[0] ?? null;
  const deltaUsd = current && earliest24h ? current.equityUsd - earliest24h.equityUsd : null;
  const deltaPct =
    current && earliest24h && earliest24h.equityUsd > 0
      ? ((current.equityUsd - earliest24h.equityUsd) / earliest24h.equityUsd) * 100
      : null;
  const deltaTone = deltaUsd === null
    ? "text-muted-foreground"
    : deltaUsd >= 0
      ? "text-[var(--neon-green)]"
      : "text-[var(--neon-red)]";
  const onlyOne = snaps.length === 1 && current;

  const risk = watcher?.ticks[0]?.context?.risk;
  const status = risk?.status ?? "normal";
  const tone = STATUS_TONE[status] ?? STATUS_TONE.normal!;

  return (
    <section className="flex h-full flex-col border border-[var(--hairline-strong)] bg-black p-5">
      <header className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Equity
      </header>
      <div className="mt-1 font-mono text-3xl tabular-nums text-foreground">
        ${fmtUsd(current?.equityUsd, 2)}
      </div>
      <div className={`mt-1 font-mono text-xs tabular-nums ${deltaTone}`}>
        {onlyOne
          ? `first snapshot ${Math.max(0, Math.round((Date.now() - new Date(current!.ts).getTime()) / 60_000))}m ago`
          : deltaUsd === null
            ? "loading..."
            : `${deltaUsd >= 0 ? "+" : ""}$${fmtUsd(deltaUsd, 2)} (${fmtPct(deltaPct)}) 24h`}
      </div>

      <div className="mt-5 border-t border-[var(--hairline)] pt-3">
        <header className="flex items-baseline justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Risk
          </span>
          <span className={`font-mono text-xs font-bold uppercase tracking-[0.14em] ${tone.text}`}>
            {tone.label}
          </span>
        </header>
        <dl className="mt-2 space-y-1.5 font-mono text-xs">
          <div className="flex items-baseline justify-between">
            <dt className="text-muted-foreground">Closest liq</dt>
            <dd className="tabular-nums text-foreground">
              {risk?.closestLiquidationDistancePct !== null && risk?.closestLiquidationDistancePct !== undefined
                ? `${risk.closestLiquidationDistancePct.toFixed(2)}% away`
                : "n/a"}
            </dd>
          </div>
          <div className="flex items-baseline justify-between">
            <dt className="text-muted-foreground">Margin usage</dt>
            <dd className="tabular-nums text-foreground">
              {risk?.account?.marginUsagePct !== null && risk?.account?.marginUsagePct !== undefined
                ? `${risk.account.marginUsagePct.toFixed(1)}%`
                : "n/a"}
            </dd>
          </div>
          <div className="flex items-baseline justify-between">
            <dt className="text-muted-foreground">Open exposure</dt>
            <dd className="tabular-nums text-foreground">
              ${fmtUsd(risk?.totalExposureUsd, 0)}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
