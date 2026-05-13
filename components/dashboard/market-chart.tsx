"use client";

import { useEffect, useRef } from "react";
import {
  createChart, CandlestickSeries, LineSeries, AreaSeries, createSeriesMarkers,
  type IChartApi, type CandlestickData, type LineData, type Time, type SeriesMarker,
} from "lightweight-charts";
import type { ChartType } from "./market-chart-controls";

export type ChartCandle = { t: number; o: string; h: string; l: string; c: string };
export type TradeMarker = {
  time: number; side: "long" | "short"; isExit: boolean; text?: string;
};

const CYAN = "#00d4ff";
const RED = "#ff3366";
const HAIRLINE = "rgba(255,255,255,0.18)";
const GRID = "rgba(255,255,255,0.04)";

export function MarketChart({
  candles, markers, chartType,
}: {
  candles: ChartCandle[];
  markers: TradeMarker[];
  chartType: ChartType;
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
      position: m.side === "long" ? "belowBar" : "aboveBar",
      color: m.isExit ? "#737373" : (m.side === "long" ? "#00ff7f" : RED),
      shape: m.side === "long" ? "arrowUp" : "arrowDown",
      text: m.text,
    }));
    createSeriesMarkers(series, seriesMarkers);

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const onResize = () => chart.applyOptions({ width: container.clientWidth });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, markers, chartType]);

  return <div ref={containerRef} className="w-full" />;
}
