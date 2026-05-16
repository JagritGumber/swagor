"use client";

import { useEffect, useRef } from "react";
import {
  createChart, CandlestickSeries, LineSeries, AreaSeries, createSeriesMarkers,
  type IChartApi, type ISeriesApi, type ISeriesMarkersPluginApi,
  type CandlestickData, type LineData, type Time, type SeriesMarker, type MouseEventParams,
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
// Tinted dark-navy chart surface (TradingView-ish #131722) so the
// chart area is clearly distinct from the pure-black card border.
const CHART_BG = "#131722";

function exitColor(pnl: number | null): string {
  if (pnl === null) return GREY;
  return pnl >= 0 ? GREEN : RED;
}

type AnySeries = ISeriesApi<"Candlestick"> | ISeriesApi<"Line"> | ISeriesApi<"Area">;

function createSeries(chart: IChartApi, type: ChartType): AnySeries {
  if (type === "candles") return chart.addSeries(CandlestickSeries, {
    upColor: CYAN, downColor: RED, borderUpColor: CYAN, borderDownColor: RED,
    wickUpColor: CYAN, wickDownColor: RED,
  });
  if (type === "line") return chart.addSeries(LineSeries, { color: CYAN, lineWidth: 2 });
  return chart.addSeries(AreaSeries, {
    lineColor: CYAN, lineWidth: 2,
    topColor: "rgba(0,212,255,0.35)", bottomColor: "rgba(0,212,255,0)",
  });
}

function markerSpec(m: TradeMarker): SeriesMarker<Time> {
  return {
    time: m.time as Time,
    position: m.isExit
      ? (m.side === "long" ? "aboveBar" : "belowBar")
      : (m.side === "long" ? "belowBar" : "aboveBar"),
    color: m.isExit ? exitColor(m.pnlUsd) : (m.side === "long" ? GREEN : RED),
    shape: m.isExit ? "circle" : (m.side === "long" ? "arrowUp" : "arrowDown"),
    text: m.text,
  };
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
  const seriesRef = useRef<AnySeries | null>(null);
  const seriesTypeRef = useRef<ChartType | null>(null);
  const markersApiRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  // Refs so the once-mounted click handler reads current props.
  const markersRef = useRef<TradeMarker[]>(markers);
  const candlesRef = useRef<ChartCandle[]>(candles);
  const onMarkerClickRef = useRef(onMarkerClick);
  markersRef.current = markers;
  candlesRef.current = candles;
  onMarkerClickRef.current = onMarkerClick;

  // Mount effect: create chart + subscribe click ONCE. Subsequent prop
  // changes feed into the chart via the data/markers effects below.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth, height: 320,
      layout: { background: { color: CHART_BG }, textColor: "#737373", fontFamily: "ui-monospace, monospace" },
      grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
      timeScale: { borderColor: HAIRLINE, timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: HAIRLINE },
      crosshair: {
        vertLine: { color: CYAN, labelBackgroundColor: CYAN },
        horzLine: { color: CYAN, labelBackgroundColor: CYAN },
      },
    });
    chartRef.current = chart;

    const onClick = (param: MouseEventParams) => {
      const cb = onMarkerClickRef.current;
      const ms = markersRef.current;
      const cs = candlesRef.current;
      if (!cb || !param.time || ms.length === 0) return;
      const t = Number(param.time);
      const first = cs[0];
      const second = cs[1];
      const intervalSec = first && second ? Math.floor((second.t - first.t) / 1000) : 300;
      let best: TradeMarker | null = null;
      let bestDist = Infinity;
      for (const m of ms) {
        const dist = Math.abs(m.time - t);
        if (dist < bestDist) { bestDist = dist; best = m; }
      }
      if (best && bestDist <= intervalSec) cb(best.tradeId);
    };
    chart.subscribeClick(onClick);

    const onResize = () => chart.applyOptions({ width: container.clientWidth });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.unsubscribeClick(onClick);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      seriesTypeRef.current = null;
      markersApiRef.current = null;
    };
  }, []);

  // Series lifecycle: create on first run, swap on chartType change,
  // setData on candles change. Reuses the chart instance.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    if (seriesRef.current && seriesTypeRef.current !== chartType) {
      chart.removeSeries(seriesRef.current);
      seriesRef.current = null;
      markersApiRef.current = null;
    }

    if (!seriesRef.current) {
      seriesRef.current = createSeries(chart, chartType);
      seriesTypeRef.current = chartType;
    }

    if (chartType === "candles") {
      const data: CandlestickData[] = candles.map((c) => ({
        time: Math.floor(c.t / 1000) as Time,
        open: Number(c.o), high: Number(c.h), low: Number(c.l), close: Number(c.c),
      }));
      (seriesRef.current as ISeriesApi<"Candlestick">).setData(data);
    } else {
      const data: LineData[] = candles.map((c) => ({
        time: Math.floor(c.t / 1000) as Time, value: Number(c.c),
      }));
      (seriesRef.current as ISeriesApi<"Line"> | ISeriesApi<"Area">).setData(data);
    }
    chart.timeScale().fitContent();
  }, [candles, chartType]);

  // Markers: setMarkers on the existing primitive when possible.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const spec = markers.map(markerSpec);
    if (markersApiRef.current) {
      markersApiRef.current.setMarkers(spec);
    } else {
      markersApiRef.current = createSeriesMarkers(series, spec);
    }
  }, [markers]);

  return <div ref={containerRef} className="w-full" />;
}
