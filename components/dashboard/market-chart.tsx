"use client";

import { useEffect, useRef } from "react";
import { createChart, CandlestickSeries, type IChartApi, type CandlestickData, type Time, type SeriesMarker } from "lightweight-charts";

export type ChartCandle = { t: number; o: string; h: string; l: string; c: string };
export type TradeMarker = {
  time: number; // unix seconds
  side: "long" | "short";
  isExit: boolean;
  text?: string;
};

/**
 * Brutalist-themed candle chart with trade entry/exit markers. Cyan up
 * candles, red down candles. Markers: green up-arrow under long entries,
 * red down-arrow above short entries, hollow above for exits.
 */
export function MarketChart({
  asset, candles, markers,
}: {
  asset: string;
  candles: ChartCandle[];
  markers: TradeMarker[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 320,
      layout: { background: { color: "#000000" }, textColor: "#737373", fontFamily: "ui-monospace, monospace" },
      grid: { vertLines: { color: "rgba(255,255,255,0.04)" }, horzLines: { color: "rgba(255,255,255,0.04)" } },
      timeScale: { borderColor: "rgba(255,255,255,0.18)", timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.18)" },
      crosshair: { vertLine: { color: "#00d4ff", labelBackgroundColor: "#00d4ff" }, horzLine: { color: "#00d4ff", labelBackgroundColor: "#00d4ff" } },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#00d4ff", downColor: "#ff3366",
      borderUpColor: "#00d4ff", borderDownColor: "#ff3366",
      wickUpColor: "#00d4ff", wickDownColor: "#ff3366",
    });

    const data: CandlestickData[] = candles.map((c) => ({
      time: Math.floor(c.t / 1000) as Time,
      open: Number(c.o), high: Number(c.h), low: Number(c.l), close: Number(c.c),
    }));
    series.setData(data);

    const seriesMarkers: SeriesMarker<Time>[] = markers.map((m) => ({
      time: m.time as Time,
      position: m.side === "long" ? "belowBar" : "aboveBar",
      color: m.isExit ? "#737373" : (m.side === "long" ? "#00ff7f" : "#ff3366"),
      shape: m.side === "long" ? "arrowUp" : "arrowDown",
      text: m.text,
    }));
    series.setMarkers(seriesMarkers);

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const onResize = () => chart.applyOptions({ width: container.clientWidth });
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, markers]);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <div className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {asset} · 5m · last 24h
        </div>
      </div>
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
