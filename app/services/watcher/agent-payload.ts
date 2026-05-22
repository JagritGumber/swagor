import type { SelboTickInput } from "./selbo-tick-types";
import type { SymbolMarketFeatures } from "@/lib/market-features";

/**
 * Compact the rich SelboTickInput into the JSON the trader agent reads. We
 * surface market STRUCTURE (volume profile / value area, regime, OI flow,
 * a short candle tail) as context, never as commands. Same builder for live
 * and backtest so the agent sees the same shape in both.
 */
function trendOf(tf: SymbolMarketFeatures["timeframes"]["4h"]) {
  return { trend: tf?.emaTrend ?? null, rsi: tf?.rsi14 ?? null, regime: tf?.marketRegime ?? null };
}

function symbolView(s: SymbolMarketFeatures) {
  const ps = s.perpMarketState;
  const tf = s.timeframes["1h"];
  return {
    symbol: s.symbol,
    price: s.mark ?? s.mid,
    regime: ps.regime,
    htfTrend: { "1d": trendOf(s.timeframes["1d"]), "4h": trendOf(s.timeframes["4h"]) },
    valueLocation: ps.valueLocation,
    valueArea: { vwap: ps.levels.vwap, poc: ps.levels.poc, vah: ps.levels.vah, val: ps.levels.val },
    structure: ps.structureState,
    auction: ps.auctionState,
    flow: ps.derivativesFlow.flowRead,
    funding: ps.derivativesFlow.fundingState,
    openInterest: s.openInterestChangeHint,
    rsi1h: tf?.rsi14 ?? null,
    emaTrend1h: tf?.emaTrend ?? null,
    atrPct1h: tf?.atrPct ?? null,
    note: ps.brief,
    recentCandles: s.recentCandles.slice(-16).map((c) => [c.t, c.o, c.h, c.l, c.c, c.v]),
  };
}

export function buildAgentPayload(input: SelboTickInput): string {
  const risk = input.risk as {
    status?: string; summary?: string;
    account?: { equityUsd: number | null; marginUsagePct: number | null };
    closestLiquidationDistancePct?: number | null;
  };
  return JSON.stringify({
    asOf: input.asOf,
    strategy: input.strategyText || "(no explicit strategy provided; trade sensibly)",
    positions: input.positions
      .filter((p) => p.side === "long" || p.side === "short")
      .map((p) => ({ asset: p.asset, side: p.side, entry: p.entryPrice, mark: p.markPrice, sizeUsd: p.sizeUsd ?? null, openedAt: p.openedAt ?? null })),
    risk: {
      status: risk.status ?? "unknown",
      summary: risk.summary ?? null,
      equityUsd: risk.account?.equityUsd ?? null,
      marginUsagePct: risk.account?.marginUsagePct ?? null,
      closestLiquidationDistancePct: risk.closestLiquidationDistancePct ?? null,
    },
    markets: input.marketFeatures.symbols.map(symbolView),
    lessons: input.recentLessons.slice(0, 12),
  });
}
