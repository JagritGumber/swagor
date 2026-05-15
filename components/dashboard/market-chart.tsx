"use client";

import { useEffect, useRef } from "react";
import {
  createChart, CandlestickSeries, LineSeries, AreaSeries, createSeriesMarkers,
  type IChartApi, type CandlestickData, type LineData, type Time, type SeriesMarker,
} from "lightweight-charts";
import type { ChartType } from "./market-chart-controls";

export type ChartCandle = { t: number; o: string; h: string; l: string; c: string };
export type TradeMarker = {
  time: number; side: "long" | "short"; isExit: boolean;
  tradeId: string; pnlUsd: number | null; text?: string;
};

const CYAN = "#00d4ff";
const RED = "#ff3366";
const GREEN = "#00ff7f";
const GREY = "#737373";
const HAIRLINE = "rgba(255,255,255,0.18)";
const GRID = "rgba(255,255,255,0.04)";

function exitColor(pnl: number | null): string {
  if (pnl === null) return GREY;
  return pnl >= 0 ? GREEN : RED;
}

export function MarketChart({
  candles, markers, chartType, onMarkerClick,
}: {
  candles: ChartCandle[];
  markers: TradeMarker[];
  chartType: ChartType;
  onMarkerClick?: (tradeId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth, height: 320,
      layout: { background: { color: "#000000" }, textColor: "#737373", fontFamily: "ui-monospace, monospace" },
      grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
      timeScale: { borderColor: HAIRLINE, timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: HAIRLINE },
      crosshair: {
        vertLine: { color: CYAN, labelBackgroundColor: CYAN },
        horzLine: { color: CYAN, labelBackgroundColor: CYAN },
      },
    });

    const series = chartType === "candles"
      ? chart.addSeries(CandlestickSeries, {
          upColor: CYAN, downColor: RED,
          borderUpColor: CYAN, borderDownColor: RED,
          wickUpColor: CYAN, wickDownColor: RED,
        })
      : chartType === "line"
      ? chart.addSeries(LineSeries, { color: CYAN, lineWidth: 2 })
      : chart.addSeries(AreaSeries, {
          lineColor: CYAN, lineWidth: 2,
          topColor: "rgba(0,212,255,0.35)", bottomColor: "rgba(0,212,255,0)",
        });

    if (chartType === "candles") {
      const data: CandlestickData[] = candles.map((c) => ({
        time: Math.floor(c.t / 1000) as Time,
        open: Number(c.o), high: Number(c.h), low: Number(c.l), close: Number(c.c),
      }));
      series.setData(data);
    } else {
      const data: LineData[] = candles.map((c) => ({
        time: Math.floor(c.t / 1000) as Time, value: Number(c.c),
      }));
      series.setData(data);
    }

    const seriesMarkers: SeriesMarker<Time>[] = markers.map((m) => ({
      time: m.time as Time,
      position: m.isExit
        ? (m.side === "long" ? "aboveBar" : "belowBar")
        : (m.side === "long" ? "belowBar" : "aboveBar"),
      color: m.isExit ? exitColor(m.pnlUsd) : (m.side === "long" ? GREEN : RED),
      shape: m.isExit ? "circle" : (m.side === "long" ? "arrowUp" : "arrowDown"),
      text: m.text,
    }));
    createSeriesMarkers(series, seriesMarkers);

    // Click-to-open. Find the nearest marker by time on click; if within
    // tolerance, invoke onMarkerClick with the tradeId. Tolerance scales
    // with interval -- one bar width on either side.
    const click = chart.subscribeClick((param) => {
      if (!onMarkerClick || !param.time || markers.length === 0) return;
      const t = Number(param.time);
      const intervalSec = candles.length > 1
        ? Math.floor((candles[1]!.t - candles[0]!.t) / 1000)
        : 300;
      let best: TradeMarker | null = null;
      let bestDist = Infinity;
      for (const m of markers) {
        const dist = Math.abs(m.time - t);
        if (dist < bestDist) { bestDist = dist; best = m; }
      }
      if (best && bestDist <= intervalSec) onMarkerClick(best.tradeId);
    });
    void click;

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const onResize = () => chart.applyOptions({ width: container.clientWidth });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, markers, chartType, onMarkerClick]);

  return <div ref={containerRef} className="w-full" />;
}
