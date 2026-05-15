"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart, AreaSeries, type IChartApi, type LineData, type Time,
} from "lightweight-charts";

type EquityRecent = {
  snapshots: Array<{ ts: string; equityUsd: number }>;
  lifetime: { start: number | null; high: number | null; low: number | null };
};

type Range = 1 | 7 | 30;

const RANGE_LABEL: Record<Range, string> = { 1: "1D", 7: "7D", 30: "30D" };

const CYAN = "#00d4ff";
const HAIRLINE = "rgba(255,255,255,0.18)";
const GRID = "rgba(255,255,255,0.04)";

function fmtUsd(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "n/a";
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

/**
 * Wallet equity area chart. Fetches /api/equity/recent for the selected
 * range. With a single snapshot, renders a placeholder card with the
 * one value visible so the user sees the writer is alive.
 */
export function EquityCurve() {
  const [range, setRange] = useState<Range>(1);
  const [data, setData] = useState<EquityRecent | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    fetch(`/api/equity/recent?days=${range}`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() as Promise<EquityRecent> : Promise.reject(r.status))
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { /* swallow */ });
    return () => { cancelled = true; };
  }, [range]);

  useEffect(() => {
    if (!containerRef.current || !data || data.snapshots.length < 2) return;
    const container = containerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth, height: 180,
      layout: { background: { color: "#000000" }, textColor: "#737373", fontFamily: "ui-monospace, monospace" },
      grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
      timeScale: { borderColor: HAIRLINE, timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: HAIRLINE },
      crosshair: { vertLine: { color: CYAN }, horzLine: { color: CYAN } },
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor: CYAN, lineWidth: 2,
      topColor: "rgba(0,212,255,0.30)", bottomColor: "rgba(0,212,255,0)",
    });
    const points: LineData[] = data.snapshots.map((s) => ({
      time: Math.floor(new Date(s.ts).getTime() / 1000) as Time,
      value: s.equityUsd,
    }));
    series.setData(points);
    chart.timeScale().fitContent();
    chartRef.current = chart;
    const onResize = () => chart.applyOptions({ width: container.clientWidth });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [data]);

  const last = data?.snapshots[data.snapshots.length - 1];
  const start = data?.lifetime.start;
  const delta = last && start !== null && start !== undefined ? last.equityUsd - start : null;
  const deltaTone = delta === null
    ? "text-muted-foreground"
    : delta >= 0 ? "text-[var(--neon-green)]" : "text-[var(--neon-red)]";

  return (
    <section className="flex h-full flex-col border border-[var(--hairline-strong)] bg-black p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex items-baseline gap-3">
          <span aria-hidden className="inline-block h-2 w-2 bg-[var(--neon-cyan)]" />
          <h3 className="text-sm font-bold uppercase tracking-tight text-foreground">
            Equity history
          </h3>
        </div>
        <div className="flex gap-1 font-mono text-[10px] uppercase tracking-[0.14em]">
          {([1, 7, 30] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`px-2 py-0.5 border ${r === range ? "border-[var(--neon-cyan)] text-[var(--neon-cyan)]" : "border-[var(--hairline)] text-muted-foreground hover:text-foreground"}`}
            >
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
      </header>

      <div className="mt-2 font-mono text-2xl tabular-nums text-foreground">
        {fmtUsd(last?.equityUsd ?? null)}
      </div>
      <div className={`mt-0.5 font-mono text-[11px] tabular-nums ${deltaTone}`}>
        {delta === null
          ? data?.snapshots.length === 1 ? "first snapshot just landed" : "loading..."
          : `${delta >= 0 ? "+" : ""}${fmtUsd(delta)} since start of range`}
      </div>

      {data && data.snapshots.length < 2 ? (
        <div className="mt-3 flex flex-1 items-center justify-center border border-dashed border-[var(--hairline)] p-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Need at least 2 snapshots to draw a curve
          </p>
        </div>
      ) : (
        <div ref={containerRef} className="mt-3 w-full" />
      )}
    </section>
  );
}
