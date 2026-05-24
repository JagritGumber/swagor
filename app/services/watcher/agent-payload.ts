import type { SelboTickInput, SetupRecordLookup } from "./selbo-tick-types";
import type { SymbolMarketFeatures } from "@/lib/market-features";

/**
 * Compact the rich SelboTickInput into the JSON the trader agent reads. We
 * surface market STRUCTURE (volume profile / value area, regime, OI flow,
 * a short candle tail) as context, never as commands. Same builder for live
 * and backtest so the agent sees the same shape in both.
 *
 * Per-symbol yourSetupRecord surfaces the agent's empirical EV on the exact
 * setup it is considering on BOTH sides. Each leaf is null until N>=3 -- below
 * threshold the agent decides on structure alone (no prose self-restraint).
 */
function symbolView(s: SymbolMarketFeatures, lookup?: SetupRecordLookup) {
  const ps = s.perpMarketState;
  const tf = s.timeframes["1h"];
  // RSI and EMA-derived trend are intentionally NOT surfaced: on choppy crypto
  // perps they produce false signals (RSI stays overbought/oversold for long
  // stretches in real trends and flips on noise in chop; EMA crossovers are
  // mediocre standalone). The agent reads trend from price + structure + flow.
  const recordIfLong = lookup ? lookup(s.symbol, "long") : { fingerprint: null, assetSide: null };
  const recordIfShort = lookup ? lookup(s.symbol, "short") : { fingerprint: null, assetSide: null };
  return {
    symbol: s.symbol,
    price: s.mark ?? s.mid,
    regime: ps.regime,
    valueLocation: ps.valueLocation,
    valueArea: { vwap: ps.levels.vwap, poc: ps.levels.poc, vah: ps.levels.vah, val: ps.levels.val },
    structure: ps.structureState,
    auction: ps.auctionState,
    flow: ps.derivativesFlow.flowRead,
    funding: ps.derivativesFlow.fundingState,
    openInterest: s.openInterestChangeHint,
    atrPct1h: tf?.atrPct ?? null,
    note: ps.brief,
    recentCandles: s.recentCandles.slice(-16).map((c) => [c.t, c.o, c.h, c.l, c.c, c.v]),
    yourSetupRecord: { ifLong: recordIfLong, ifShort: recordIfShort },
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
    markets: input.marketFeatures.symbols.map((s) => symbolView(s, input.setupRecordLookup)),
  });
}
