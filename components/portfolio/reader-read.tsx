"use client";

import { useEffect, useState } from "react";

type ReaderRegime = {
  mode: string;
  label: string;
  highVol: boolean;
  rangePct: number;
  driftPct: number;
  directionalEfficiency: number;
  reason: string;
};

type ReaderAuctionProfile = {
  poc: number;
  valueAreaLow: number;
  valueAreaHigh: number;
  binCount: number;
};

type ReaderAuctionLevel = {
  price: number;
  kind: string;
  touches: number;
};

type ReaderAuction = {
  location: string;
  locationLabel: string;
  bias: string;
  narrative: string;
  invalidation: string | null;
  target: string | null;
  profile: ReaderAuctionProfile | null;
  level: ReaderAuctionLevel | null;
};

type ReaderRead = {
  asset: string;
  interval: string;
  lastPrice: number;
  lastCandleAt: string;
  readAt: string;
  candleCount: number;
  regime: ReaderRegime;
  auction: ReaderAuction;
  summary: string;
};

const REGIME_TONE: Record<string, string> = {
  "trend-up": "text-[var(--neon-green)]",
  "trend-down": "text-[var(--neon-red)]",
  "range": "text-[var(--neon-cyan)]",
  "high-vol": "text-orange-400",
  "unknown": "text-muted-foreground",
};

const BIAS_TONE: Record<string, string> = {
  long: "text-[var(--neon-green)]",
  short: "text-[var(--neon-red)]",
  wait: "text-muted-foreground",
};

function fmtPrice(n: number): string {
  return n >= 100 ? n.toFixed(2) : n >= 1 ? n.toFixed(4) : n.toFixed(6);
}

function ago(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function useReaderPoll(asset: string): ReaderRead | null {
  const [data, setData] = useState<ReaderRead | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    async function pull() {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/reader-read?asset=${asset}&interval=1h`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        setData((await res.json()) as ReaderRead);
      } catch {
        // silently retry
      }
      if (!cancelled) timer = setTimeout(pull, 60_000);
    }

    pull();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [asset]);

  return data;
}

export function ReaderCard({ asset = "ETH" }: { asset?: string }) {
  const read = useReaderPoll(asset);

  if (!read) {
    return (
      <section className="border border-[var(--hairline-strong)] bg-black p-4">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <span aria-hidden className="inline-block h-2 w-2 bg-[var(--neon-cyan)]" />
          Reading market...
        </div>
      </section>
    );
  }

  const { regime, auction } = read;

  return (
    <section className="border border-[var(--hairline-strong)] bg-black">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--hairline-strong)] px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-foreground">{read.asset}</span>
          <span className={`font-mono text-[11px] uppercase tracking-[0.16em] ${REGIME_TONE[regime.mode] ?? "text-muted-foreground"}`}>
            {regime.label}
          </span>
          {regime.highVol && (
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-orange-400">
              High vol
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <span>${fmtPrice(read.lastPrice)}</span>
          <span>{ago(read.readAt)}</span>
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-3 divide-x divide-[var(--hairline-strong)]">
        {/* Regime column */}
        <div className="space-y-2 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Regime</p>
          <div className="space-y-1 font-mono text-[12px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Range</span>
              <span className="text-foreground tabular-nums">{regime.rangePct}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Drift</span>
              <span className="text-foreground tabular-nums">{regime.driftPct}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Efficiency</span>
              <span className="text-foreground tabular-nums">{regime.directionalEfficiency}</span>
            </div>
          </div>
          <p className="text-[11px] leading-tight text-foreground/60">{regime.reason}</p>
        </div>

        {/* Auction column */}
        <div className="space-y-2 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Auction</p>
          <p className={`text-sm font-bold ${BIAS_TONE[auction.bias] ?? "text-muted-foreground"}`}>
            {auction.locationLabel}
          </p>
          {auction.profile && (
            <div className="space-y-1 font-mono text-[12px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">POC</span>
                <span className="text-foreground tabular-nums">${fmtPrice(auction.profile.poc)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">VA low</span>
                <span className="text-foreground tabular-nums">${fmtPrice(auction.profile.valueAreaLow)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">VA high</span>
                <span className="text-foreground tabular-nums">${fmtPrice(auction.profile.valueAreaHigh)}</span>
              </div>
            </div>
          )}
          <p className="line-clamp-2 text-[11px] leading-tight text-foreground/60">{auction.narrative}</p>
        </div>

        {/* Summary column */}
        <div className="space-y-2 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Thesis</p>
          <p className="text-sm leading-snug text-foreground/80">{auction.narrative}</p>
          {auction.invalidation && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Invalidation</p>
              <p className="text-[12px] text-[var(--neon-red)]/80">{auction.invalidation}</p>
            </div>
          )}
          {auction.target && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Target</p>
              <p className="text-[12px] text-[var(--neon-green)]/80">{auction.target}</p>
            </div>
          )}
          <p className="line-clamp-2 border-l-2 border-[var(--neon-cyan)]/40 pl-2 text-[11px] italic text-foreground/50">
            {read.summary}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-[var(--hairline-strong)] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        <span>{read.candleCount} candles · {read.interval}</span>
        <span>Bias: <span className={BIAS_TONE[auction.bias]}>{auction.bias}</span></span>
      </div>
    </section>
  );
}
