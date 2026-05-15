"use client";

import { useWatcherPoll, type WatcherMarketFeatureSnapshot } from "@/lib/utils/use-watcher-poll";

type SymbolFeature = WatcherMarketFeatureSnapshot["symbols"][number];

const BIAS_LABEL: Record<SymbolFeature["candidateBias"], string> = {
  supports_long: "long bias",
  supports_short: "short bias",
  mixed: "mixed",
  avoid_new_risk: "risk-off",
  unknown: "unknown",
};

const QUALITY_TONE: Record<SymbolFeature["timeframes"]["5m"]["featureQuality"], string> = {
  fresh: "text-[var(--neon-green)]",
  partial: "text-amber-300",
  stale: "text-orange-400",
  unavailable: "text-[var(--neon-red)]",
};

const BIAS_TONE: Record<SymbolFeature["candidateBias"], string> = {
  supports_long: "text-[var(--neon-green)]",
  supports_short: "text-[var(--neon-red)]",
  mixed: "text-[var(--neon-cyan)]",
  avoid_new_risk: "text-orange-400",
  unknown: "text-muted-foreground",
};

function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "n/a";
  return n.toFixed(digits);
}

function describe(feature: SymbolFeature): string {
  if (feature.candidateBias === "avoid_new_risk") {
    return `${feature.symbol}: risk-off conditions; watch, do not casually add leverage.`;
  }
  if (feature.candidateBias === "supports_long") {
    return `${feature.symbol}: trend tools support long-side setups if risk allows.`;
  }
  if (feature.candidateBias === "supports_short") {
    return `${feature.symbol}: trend tools support short-side setups if risk allows.`;
  }
  if (feature.candidateBias === "mixed") {
    return `${feature.symbol}: no clean directional setup across timeframes.`;
  }
  return `${feature.symbol}: feature quality is not strong enough for a directional read.`;
}

/**
 * Compact market-state synthesis from the deterministic feature layer.
 * This is intentionally not a trading signal card; it explains the factual
 * market context Selbo fed into the watcher/trader agents.
 */
export function MarketStateCard() {
  const data = useWatcherPoll({ limit: 1 });
  const features = data?.ticks[0]?.context?.marketFeatures;
  const rows = features?.symbols ?? [];

  if (!features) {
    return (
      <section className="border border-[var(--hairline-strong)] bg-black p-6">
        <header className="flex items-baseline gap-3">
          <span aria-hidden className="inline-block h-2.5 w-2.5 bg-[var(--neon-cyan)]" />
          <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
            Market state
          </h2>
        </header>
        <p className="mt-4 border border-dashed border-[var(--hairline-strong)] bg-[#080808] p-4 text-sm text-muted-foreground">
          No market feature snapshot yet. Selbo will compute indicators on the next watcher tick.
        </p>
      </section>
    );
  }

  return (
    <section className="border border-[var(--hairline-strong)] bg-black p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="flex items-baseline gap-3">
          <span aria-hidden className="inline-block h-2.5 w-2.5 bg-[var(--neon-cyan)]" />
          <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
            Market state
          </h2>
        </div>
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          deterministic features · {new Date(features.generatedAt).toLocaleTimeString()}
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="mt-4 border border-dashed border-[var(--hairline-strong)] bg-[#080808] p-4 text-sm text-muted-foreground">
          Market features unavailable; Selbo is falling back to mark, funding, news, and risk only.
        </p>
      ) : (
        <ol className="mt-4 divide-y divide-[var(--hairline)] border-y border-[var(--hairline)]">
          {rows.map((row) => {
            const five = row.timeframes["5m"];
            const hourly = row.timeframes["1h"];
            return (
              <li key={row.symbol} className="py-3">
                <div className="grid grid-cols-[54px_1fr_auto] items-baseline gap-4">
                  <span className="font-mono text-sm font-bold text-foreground">
                    {row.symbol}
                  </span>
                  <span className="text-sm leading-relaxed text-foreground">
                    {describe(row)}
                  </span>
                  <span className={`font-mono text-[10px] uppercase tracking-[0.16em] ${BIAS_TONE[row.candidateBias]}`}>
                    {BIAS_LABEL[row.candidateBias]}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground sm:grid-cols-5">
                  <span>
                    5m RSI <span className="text-foreground">{fmtNum(five.rsi14, 1)}</span>
                  </span>
                  <span>
                    EMA <span className="text-foreground">{five.emaTrend}</span>
                  </span>
                  <span>
                    ATR <span className="text-foreground">{fmtNum(five.atrPct)}%</span>
                  </span>
                  <span>
                    1h <span className="text-foreground">{hourly.marketRegime.replace(/_/g, " ")}</span>
                  </span>
                  <span className={QUALITY_TONE[five.featureQuality]}>
                    {five.featureQuality}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  cadence {row.cadenceHint.replace(/_/g, " ")} · {row.cadenceReason}
                </p>
              </li>
            );
          })}
        </ol>
      )}

      {features.skippedSymbols.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Skipped {features.skippedSymbols.map((s) => s.symbol).join(", ")} because they are not valid Hyperliquid symbols.
        </p>
      )}
    </section>
  );
}

