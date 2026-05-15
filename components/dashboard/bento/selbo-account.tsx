"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart, AreaSeries,
  type IChartApi, type ISeriesApi, type LineData, type Time,
} from "lightweight-charts";

type EquityRecent = {
  snapshots: Array<{ ts: string; equityUsd: number }>;
  lifetime: { start: number | null; high: number | null; low: number | null };
};

const CYAN = "#00d4ff";
const HAIRLINE = "rgba(255,255,255,0.18)";
const GRID = "rgba(255,255,255,0.03)";

// Dummy fallback so the UI shape is visible before any real ticks fire.
// Remove the dummy snapshots when the watcher writer has produced enough
// rows for a real curve.
function dummySnapshots(): EquityRecent {
  const now = Date.now();
  const snapshots = Array.from({ length: 24 }, (_, i) => ({
    ts: new Date(now - (23 - i) * 60 * 60 * 1000).toISOString(),
    equityUsd: 1000 + Math.sin(i / 3) * 8 + i * 0.4,
  }));
  const values = snapshots.map((s) => s.equityUsd);
  return {
    snapshots,
    lifetime: {
      start: values[0]!,
      high: Math.max(...values),
      low: Math.min(...values),
    },
  };
}

function fmtUsd(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "$NA";
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

/**
 * Selbo's account: equity number on top, thin area chart below in the
 * same card. Compact 4-col bento tile. Falls back to dummy data when
 * no real snapshots exist so the user sees the shape immediately.
 */
export function SelboAccount() {
  const [data, setData] = useState<EquityRecent | null>(null);
  const [isDummy, setIsDummy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  // Poll every 60s so the equity number + histogram refresh as the
  // watcher writer lands new snapshots. Pauses on tab hidden so we do
  // not burn requests in background tabs; refetches immediately on
  // visibilitychange back to visible.
  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/equity/recent?days=1", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const d = (await res.json()) as EquityRecent;
        if (cancelled) return;
        if (d.snapshots.length < 2) {
          setData(dummySnapshots());
          setIsDummy(true);
        } else {
          setData(d);
          setIsDummy(false);
        }
      } catch {
        if (cancelled) return;
        setData((prev) => prev ?? dummySnapshots());
        setIsDummy((prev) => prev || true);
      }
    };
    void pull();
    const id = setInterval(pull, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") void pull(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth, height: 80,
      layout: { background: { color: "#000000" }, textColor: "#525252", fontFamily: "ui-monospace, monospace" },
      grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
      timeScale: { borderColor: HAIRLINE, visible: false },
      rightPriceScale: { borderColor: HAIRLINE, visible: false },
      crosshair: { vertLine: { visible: false }, horzLine: { visible: false } },
      handleScroll: false, handleScale: false,
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor: CYAN, lineWidth: 2,
      topColor: "rgba(0,212,255,0.35)", bottomColor: "rgba(0,212,255,0)",
      priceLineVisible: false, lastValueVisible: false,
    });
    chartRef.current = chart;
    seriesRef.current = series;
    const onResize = () => chart.applyOptions({ width: container.clientWidth });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current || !data || data.snapshots.length < 2) return;
    const points: LineData[] = data.snapshots.map((s) => ({
      time: Math.floor(new Date(s.ts).getTime() / 1000) as Time,
      value: s.equityUsd,
    }));
    seriesRef.current.setData(points);
    chartRef.current.timeScale().fitContent();
  }, [data]);

  const last = data?.snapshots[data.snapshots.length - 1];
  const start = data?.lifetime.start;
  const delta = last && start !== null && start !== undefined ? last.equityUsd - start : null;
  const deltaPct = last && start && start > 0 ? ((last.equityUsd - start) / start) * 100 : null;
  const deltaTone = delta === null
    ? "text-muted-foreground"
    : delta >= 0 ? "text-[var(--neon-green)]" : "text-[var(--neon-red)]";

  return (
    <section className="flex h-full flex-col border border-[var(--hairline-strong)] bg-black p-5">
      <header className="flex items-baseline justify-between gap-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Selbo&apos;s account
        </div>
        {isDummy && (
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground/60">
            dummy
          </span>
        )}
      </header>
      <div className="mt-1 font-mono text-3xl tabular-nums text-foreground">
        {fmtUsd(last?.equityUsd ?? null)}
      </div>
      <div className={`mt-0.5 font-mono text-[11px] tabular-nums ${deltaTone}`}>
        {delta === null
          ? "no snapshots yet"
          : `${delta >= 0 ? "+" : ""}${fmtUsd(delta)} (${deltaPct! >= 0 ? "+" : ""}${deltaPct!.toFixed(2)}%) 24h`}
      </div>
      <div ref={containerRef} className="mt-3 w-full" />
    </section>
  );
}
