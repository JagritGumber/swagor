"use client";

import { useEffect, useState } from "react";
import { MarketChart, type ChartCandle, type TradeMarker } from "./market-chart";
import {
  MarketChartControls, type ChartType, type Interval,
} from "./market-chart-controls";

const DEFAULT_INTERVAL: Interval = "5m";
const DEFAULT_LOOKBACK_MS = 86_400_000;
const DEFAULT_CHART_TYPE: ChartType = "candles";

export function MarketChartShell({ watching }: { watching: string[] }) {
  const [asset, setAsset] = useState(watching[0] ?? "ETH");
  const [interval, setInterval_] = useState<Interval>(DEFAULT_INTERVAL);
  const [lookbackMs, setLookbackMs] = useState<number>(DEFAULT_LOOKBACK_MS);
  const [chartType, setChartType] = useState<ChartType>(DEFAULT_CHART_TYPE);
  const [candles, setCandles] = useState<ChartCandle[]>([]);
  const [markers, setMarkers] = useState<TradeMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    setLoading(true); setErr(null);
    const qs = new URLSearchParams({ asset, interval, lookbackMs: String(lookbackMs) });
    fetch(`/api/chart-data?${qs}`, { cache: "no-store", signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { candles?: ChartCandle[]; markers?: TradeMarker[] };
        if (!cancelled) {
          setCandles(data.candles ?? []);
          setMarkers(data.markers ?? []);
        }
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === "AbortError") return;
        if (!cancelled) setErr(e instanceof Error ? e.message : "fetch failed");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; ac.abort(); };
  }, [asset, interval, lookbackMs]);

  return (
    <div className="flex flex-col gap-4">
      <MarketChartControls
        watching={watching}
        asset={asset} interval={interval} lookbackMs={lookbackMs} chartType={chartType}
        onAsset={setAsset} onInterval={setInterval_}
        onLookback={setLookbackMs} onChartType={setChartType}
      />
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {asset} · {interval} · {loading ? "loading..." : `${candles.length} candles`}
        {err ? ` · ${err}` : ""}
      </div>
      <div className="relative">
        <div
          className={`transition-[filter,opacity] duration-300 ${
            loading ? "pointer-events-none opacity-60 blur-[2px]" : ""
          }`}
        >
          <MarketChart candles={candles} markers={markers} chartType={chartType} />
        </div>
        {loading && (
          <div
            role="status"
            aria-label="Loading chart"
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <div className="flex items-center gap-3 border border-[var(--neon-cyan)] bg-black/85 px-5 py-3 font-mono text-xs uppercase tracking-[0.18em] text-[var(--neon-cyan)] backdrop-blur-sm">
              <span
                aria-hidden
                className="inline-block h-3 w-3 animate-spin border-[2px] border-[var(--neon-cyan)] border-t-transparent"
              />
              <span>Loading candles</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
