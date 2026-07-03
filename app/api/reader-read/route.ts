import { NextResponse } from "next/server";
import { fetchCandles } from "@/lib/data-sources/hyperliquid";
import { readMarketAuction } from "../../../packages/strategy-lab/read-core/read/read-market-auction";
import { readMarketRegime } from "../../../packages/strategy-lab/read-core/market-regime/read-market-regime";
import type { Candle } from "../../../packages/strategy-lab/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_INTERVALS = new Set(["1m", "5m", "15m", "1h", "4h", "1d"]);
const INTERVAL_MS: Record<string, number> = {
  "1m": 60_000, "5m": 300_000, "15m": 900_000,
  "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000,
};

function toCandle(raw: { t: number; o: string; c: string; h: string; l: string; v: string }): Candle {
  return {
    t: raw.t,
    o: Number(raw.o),
    h: Number(raw.h),
    l: Number(raw.l),
    c: Number(raw.c),
    v: Number(raw.v),
  };
}

function round(v: number, decimals = 4): number {
  return Number(v.toFixed(decimals));
}

function formatAuctionLocation(location: string): string {
  const map: Record<string, string> = {
    "below-value": "Below value area",
    "value-low": "Value area low",
    "near-poc": "Near point of control",
    "value-high": "Value area high",
    "above-value": "Above value area",
    "outside-profile": "Outside profile",
  };
  return map[location] ?? location;
}

function formatRegime(mode: string): string {
  const map: Record<string, string> = {
    "range": "Ranging",
    "trend-up": "Trending up",
    "trend-down": "Trending down",
    "high-vol": "High volatility",
    "unknown": "Unknown",
  };
  return map[mode] ?? mode;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const asset = (searchParams.get("asset") ?? "ETH").toUpperCase();
  const interval = searchParams.get("interval") ?? "1h";
  const lookbackDays = Math.min(Math.max(Number(searchParams.get("lookbackDays") ?? "3"), 1), 14);

  if (!VALID_INTERVALS.has(interval)) {
    return NextResponse.json({ error: `Invalid interval. Use: ${Array.from(VALID_INTERVALS).join(", ")}` }, { status: 400 });
  }

  const now = Date.now();
  const lookbackMs = Math.min(lookbackDays * 86_400_000, INTERVAL_MS[interval] * 200);

  const rawCandles = await fetchCandles(asset, interval, now - lookbackMs, now).catch(() => []);
  if (rawCandles.length === 0) {
    return NextResponse.json({ error: "No candle data available for this asset" }, { status: 404 });
  }

  const candles: Candle[] = rawCandles.map(toCandle);
  const lastCandle = candles[candles.length - 1];

  const regime = readMarketRegime({ candles, now });
  const auction = readMarketAuction({
    asset,
    interval,
    candles,
    price: lastCandle.c,
  });

  return NextResponse.json({
    asset,
    interval,
    lastPrice: lastCandle.c,
    lastCandleAt: new Date(lastCandle.t).toISOString(),
    readAt: new Date(now).toISOString(),
    candleCount: candles.length,
    regime: {
      mode: regime.mode,
      label: formatRegime(regime.mode),
      highVol: regime.highVol,
      rangePct: round(regime.rangePct * 100, 2),
      driftPct: round(regime.driftPct * 100, 2),
      directionalEfficiency: round(regime.directionalEfficiency, 2),
      reason: regime.reason,
    },
    auction: {
      location: auction.location,
      locationLabel: formatAuctionLocation(auction.location),
      bias: auction.bias,
      narrative: auction.narrative,
      invalidation: auction.invalidation,
      target: auction.target,
      profile: auction.profile ? {
        poc: round(auction.profile.poc),
        valueAreaLow: round(auction.profile.valueAreaLow),
        valueAreaHigh: round(auction.profile.valueAreaHigh),
        binCount: auction.profile.bins.length,
      } : null,
      level: auction.level ? {
        price: round(auction.level.price),
        kind: auction.level.kind,
        touches: auction.level.touches,
      } : null,
    },
    summary: `${asset} is ${formatRegime(regime.mode)}. Price is ${formatAuctionLocation(auction.location)} at $${round(lastCandle.c)}. Bias: ${auction.bias}.`,
  });
}
