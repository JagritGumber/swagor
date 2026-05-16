"use client";

import { useCallback, useEffect, useState } from "react";
import { MarketChart, type ChartCandle, type TradeMarker } from "./market-chart";
import {
  MarketChartControls, type ChartType, type Interval,
} from "./market-chart-controls";
import { TradeDecisionDrawer } from "@/components/dashboard/bento/trade-decision-drawer";

const DEFAULT_INTERVAL: Interval = "5m";
const DEFAULT_LOOKBACK_MS = 86_400_000;
const DEFAULT_CHART_TYPE: ChartType = "candles";

/**
 * Market card body. Renders one header row (title + compact controls)
 * with a horizontal divider, then the chart edge-to-edge (no padding
 * around it), then an optional hint + decision drawer below. Drops the
 * old diagnostic line ('ETH · 5m · 208 candles · 0 markers').
 */
export function MarketChartShell({ watching, admin = false }: { watching: string[]; admin?: boolean }) {
  const [asset, setAsset] = useState(watching[0] ?? "ETH");
  const [interval, setInterval_] = useState<Interval>(DEFAULT_INTERVAL);
  const [lookbackMs, setLookbackMs] = useState<number>(DEFAULT_LOOKBACK_MS);
  const [chartType, setChartType] = useState<ChartType>(DEFAULT_CHART_TYPE);
  const [candles, setCandles] = useState<ChartCandle[]>([]);
  const [markers, setMarkers] = useState<TradeMarker[]>([]);
  const [otherAssets, setOtherAssets] = useState<string[]>([]);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const handleMarkerClick = useCallback((tradeId: string) => {
    setSelectedTradeId(tradeId);
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    setLoading(true);
    const qs = new URLSearchParams({ asset, interval, lookbackMs: String(lookbackMs) });
    fetch(`/api/chart-data?${qs}`, { cache: "no-store", signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          candles?: ChartCandle[]; markers?: TradeMarker[]; otherAssets?: string[];
        };
        if (!cancelled) {
          setCandles(data.candles ?? []);
          setMarkers(data.markers ?? []);
          setOtherAssets(data.otherAssets ?? []);
        }
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name !== "AbortError") {
          // swallow; loading indicator hides on finally
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; ac.abort(); };
  }, [asset, interval, lookbackMs]);

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--hairline)] px-6 py-3">
        <div className="flex items-baseline gap-4">
          <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
            Market
          </h2>
          {otherAssets.length > 0 && (
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--neon-cyan)]">
              +{otherAssets.length} on {otherAssets.join(", ")}
            </span>
          )}
        </div>
        <MarketChartControls
          watching={watching}
          asset={asset} interval={interval} lookbackMs={lookbackMs} chartType={chartType}
          onAsset={setAsset} onInterval={setInterval_}
          onLookback={setLookbackMs} onChartType={setChartType}
        />
      </header>

      <div className="relative">
        <div
          className={`transition-[filter,opacity] duration-300 ${
            loading ? "pointer-events-none opacity-60 blur-[2px]" : ""
          }`}
        >
          <MarketChart
            candles={candles}
            markers={markers}
            chartType={chartType}
            onMarkerClick={handleMarkerClick}
          />
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

      {markers.length > 0 && !selectedTradeId && (
        <p className="border-t border-[var(--hairline)] px-6 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Click any marker to see why Selbo took the trade
        </p>
      )}
      {selectedTradeId && (
        <div className="border-t border-[var(--hairline)] px-6 pb-6 pt-2">
          <TradeDecisionDrawer
            tradeId={selectedTradeId}
            admin={admin}
            onClose={() => setSelectedTradeId(null)}
          />
        </div>
      )}
    </>
  );
}
