import type { Candle } from "@/lib/data-sources/hyperliquid";
import { atrPct, closes, ema, realizedVolPct, rsiWilder, type MarketFeatureSnapshot, type SymbolMarketFeatures, type TimeframeFeature } from "@/lib/market-features";
import { computeVolumeProfile } from "@/lib/volume-profile";
import { buildPerpMarketState } from "@/lib/perp-market-state";

function finiteClose(c: Candle | undefined): number | null {
  const n = Number(c?.c);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function trendOf(e20: number | null, e50: number | null): TimeframeFeature["emaTrend"] {
  if (e20 === null || e50 === null || e50 === 0) return "unknown";
  const spread = (e20 - e50) / e50;
  if (Math.abs(spread) < 0.0015) return "flat";
  return spread > 0 ? "bullish" : "bearish";
}

function tf(name: TimeframeFeature["timeframe"], candles: Candle[]): TimeframeFeature {
  const cls = closes(candles);
  const e20 = ema(cls, 20);
  const e50 = ema(cls, 50);
  return {
    timeframe: name, featureQuality: cls.length >= 20 ? "fresh" : "partial",
    lastCandleAt: candles.at(-1) ? new Date(candles.at(-1)!.t).toISOString() : null,
    candlesUsed: cls.length, missingReasons: cls.length < 20 ? ["limited historical candles"] : [],
    rsi14: rsiWilder(cls), ema20: e20, ema50: e50,
    emaTrend: trendOf(e20, e50), atrPct: atrPct(candles),
    realizedVolPct: realizedVolPct(cls), marketRegime: "unknown",
  };
}

/**
 * Build a deterministic market-feature snapshot for one historical
 * tick from cached candles. Shared by the swarm-gated backtest replay
 * and the watcher-only long replay so both see identical features.
 * Strategy mode is fixed to "scalper" (the watcher backtest path).
 */
export function buildSnapshotAt(assets: string[], cache: Map<string, Candle[]>, tickMs: number): MarketFeatureSnapshot {
  const symbols: SymbolMarketFeatures[] = assets.flatMap((asset) => {
    const history = (cache.get(asset) ?? []).filter((c) => c.t <= tickMs).slice(-120);
    const mid = finiteClose(history.at(-1));
    if (mid === null) return [];
    const recentCandles = history.slice(-20).map((c) => ({
      t: c.t, o: Number(c.o), h: Number(c.h), l: Number(c.l), c: Number(c.c), v: Number(c.v),
    }));
    const volumeProfile = computeVolumeProfile(recentCandles);
    const timeframes = { "5m": tf("5m", history), "1h": tf("1h", history), "4h": tf("4h", history), "1d": tf("1d", history) };
    const vp = {
      vwap: volumeProfile.vwap, poc: volumeProfile.poc, vah: volumeProfile.vah,
      val: volumeProfile.val, swingHigh: volumeProfile.swingHigh, swingLow: volumeProfile.swingLow,
    };
    const state = buildPerpMarketState({
      strategyMode: "scalper", symbol: asset, mid, fundingHourly: null,
      openInterestChangeHint: "unknown", openInterestDeltas: { last5m: null, last1h: null, last4h: null },
      recentCandles, timeframes, volumeProfile: vp,
    });
    return [{
      symbol: asset, mid, mark: mid, fundingHourly: null, openInterest: null,
      openInterestChangeHint: "unknown" as const,
      openInterestDeltas: { last5m: null, last1h: null, last4h: null },
      recentCandles, timeframes,
      candidateBias: "unknown" as const,
      cadenceHint: "normal" as const,
      cadenceReason: "historical watcher replay",
      volumeProfile: vp,
      perpMarketState: state,
    }];
  });
  return { source: "hyperliquid-testnet", generatedAt: new Date(tickMs).toISOString(), symbols, skippedSymbols: [] };
}
