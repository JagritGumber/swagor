"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart, AreaSeries,
  type IChartApi, type ISeriesApi, type LineData, type Time,
} from "lightweight-charts";
import { useWatcherPoll } from "@/lib/utils/use-watcher-poll";

type EquityRecent = {
  snapshots: Array<{ ts: string; equityUsd: number }>;
  lifetime: { start: number | null; high: number | null; low: number | null };
};

const CYAN = "#00d4ff";
const HAIRLINE = "rgba(255,255,255,0.18)";
const GRID = "rgba(255,255,255,0.03)";

// Dummy fallback so the UI shape is visible before any real ticks fire.
// Silent: no badge in the header. Switches to real data automatically
// when the 60s poll lands >= 2 snapshots.
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

const DUMMY_RISK = {
  status: "normal" as const,
  closestLiquidationDistancePct: 12.4,
  account: { marginUsagePct: 18 },
  totalExposureUsd: 0,
};

const STATUS_TONE: Record<string, { label: string; text: string }> = {
  normal: { label: "Normal", text: "text-emerald-400" },
  watch: { label: "Watch", text: "text-amber-300" },
  urgent: { label: "Urgent", text: "text-orange-400" },
  critical: { label: "Critical", text: "text-[var(--neon-red)]" },
};

function fmtUsd(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "$NA";
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "n/a";
  return `${n.toFixed(digits)}%`;
}

function fmtUsdShort(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "n/a";
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/**
 * Selbo's account: title + equity + thin histogram + four risk fields,
 * all in one card. Single 4-col bento tile. Falls back to dummy values
 * silently so the layout is always visible.
 */
export function SelboAccount() {
  const [data, setData] = useState<EquityRecent | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const watcher = useWatcherPoll({ limit: 1 });
  const risk = watcher?.ticks[0]?.context?.risk ?? DUMMY_RISK;
  const tone = STATUS_TONE[risk.status] ?? STATUS_TONE.normal!;

  // 60s poll with visibility pause.
  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/equity/recent?days=1", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const d = (await res.json()) as EquityRecent;
        if (cancelled) return;
        setData(d.snapshots.length < 2 ? dummySnapshots() : d);
      } catch {
        if (cancelled) return;
        setData((prev) => prev ?? dummySnapshots());
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

  const marginPct = risk.account?.marginUsagePct ?? null;
  const marginBarTone = marginPct === null
    ? "bg-muted-foreground/30"
    : marginPct < 30 ? "bg-emerald-500/80"
    : marginPct < 60 ? "bg-amber-400/80"
    : marginPct < 85 ? "bg-orange-400/80"
    : "bg-[var(--neon-red)]/80";

  return (
    <section className="flex h-full flex-col border border-[var(--hairline-strong)] bg-black p-6">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
          Selbo&apos;s account
        </h2>
        <span className={`font-mono text-[10px] uppercase tracking-[0.16em] ${tone.text}`}>
          {tone.label}
        </span>
      </header>

      <div className="mt-5 font-mono text-4xl tabular-nums leading-none text-foreground">
        {fmtUsd(last?.equityUsd ?? null)}
      </div>
      <div className={`mt-2 font-mono text-[11px] tabular-nums ${deltaTone}`}>
        {delta === null
          ? "no snapshots yet"
          : `${delta >= 0 ? "+" : ""}${fmtUsd(delta)} (${deltaPct! >= 0 ? "+" : ""}${deltaPct!.toFixed(2)}%) 24h`}
      </div>

      <div ref={containerRef} className="mt-4 w-full" />

      <div className="mt-4 space-y-1">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <span>Margin used</span>
          <span className="tabular-nums text-foreground">{fmtPct(marginPct)}</span>
        </div>
        <div className="h-1.5 w-full bg-[#0a0a0a]">
          <div
            className={`h-full ${marginBarTone}`}
            style={{ width: `${Math.min(100, Math.max(0, marginPct ?? 0))}%` }}
            aria-hidden
          />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-[var(--hairline)] pt-4 font-mono text-[11px]">
        <div>
          <dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Liq buffer</dt>
          <dd className="mt-0.5 tabular-nums text-foreground">{fmtPct(risk.closestLiquidationDistancePct)}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Exposure</dt>
          <dd className="mt-0.5 tabular-nums text-foreground">{fmtUsdShort(risk.totalExposureUsd)}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Status</dt>
          <dd className={`mt-0.5 font-bold uppercase tracking-[0.14em] ${tone.text}`}>{tone.label}</dd>
        </div>
      </dl>
    </section>
  );
}
