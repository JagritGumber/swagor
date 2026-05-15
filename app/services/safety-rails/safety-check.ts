import type { FastTraderDecision } from "@/app/services/fast-trader/prompt";
import type { MarketFeatureSnapshot, SymbolMarketFeatures } from "@/lib/market-features";
import {
  RSI_OVERBOUGHT,
  RSI_OVERSOLD,
  VPA_OI_DELTA_PCT,
  VPA_PRICE_MOVE_PCT,
} from "./constants";

export type SafetyBlockCode =
  | "safety_block_overbought"
  | "safety_block_oversold"
  | "safety_block_vpa";

export type SafetyBlock = {
  code: SafetyBlockCode;
  symbol: string;
  attemptedAction: "open_long" | "open_short";
  reason: string;
  details: {
    rsi14?: number | null;
    priceMovePct?: number | null;
    openInterestDeltaPct?: number | null;
  };
};

export type SafetyCheckResult =
  | { allow: true }
  | { allow: false; block: SafetyBlock };

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function symbolFeature(
  snapshot: MarketFeatureSnapshot,
  symbol: string,
): SymbolMarketFeatures | undefined {
  return snapshot.symbols.find((s) => s.symbol.toUpperCase() === symbol.toUpperCase());
}

function recentPriceMovePct(feature: SymbolMarketFeatures): number | null {
  const candles = feature.recentCandles;
  if (candles.length < 2) return null;
  const first = candles[0];
  const last = candles[candles.length - 1];
  if (!first || !last || first.c === 0) return null;
  return ((last.c - first.c) / first.c) * 100;
}

function primaryOiDeltaPct(feature: SymbolMarketFeatures): number | null {
  return finiteNumber(feature.openInterestDeltas.last5m)
    ?? finiteNumber(feature.openInterestDeltas.last1h)
    ?? finiteNumber(feature.openInterestDeltas.last4h);
}

export function evaluateSafetyRails(
  decision: FastTraderDecision,
  marketFeatures: MarketFeatureSnapshot,
): SafetyCheckResult {
  if (decision.action !== "open_long" && decision.action !== "open_short") {
    return { allow: true };
  }

  const symbol = decision.asset.toUpperCase();
  const feature = symbolFeature(marketFeatures, symbol);
  if (!feature) return { allow: true };

  const rsi14 = finiteNumber(feature.timeframes["5m"]?.rsi14);
  if (decision.action === "open_long" && rsi14 !== null && rsi14 > RSI_OVERBOUGHT) {
    return {
      allow: false,
      block: {
        code: "safety_block_overbought",
        symbol,
        attemptedAction: decision.action,
        reason: `${symbol} 5m RSI is ${rsi14.toFixed(1)}, above the overbought rail.`,
        details: { rsi14 },
      },
    };
  }
  if (decision.action === "open_short" && rsi14 !== null && rsi14 < RSI_OVERSOLD) {
    return {
      allow: false,
      block: {
        code: "safety_block_oversold",
        symbol,
        attemptedAction: decision.action,
        reason: `${symbol} 5m RSI is ${rsi14.toFixed(1)}, below the oversold rail.`,
        details: { rsi14 },
      },
    };
  }

  const priceMovePct = recentPriceMovePct(feature);
  const openInterestDeltaPct = primaryOiDeltaPct(feature);
  const hasVpaContradiction =
    priceMovePct !== null
    && openInterestDeltaPct !== null
    && Math.abs(priceMovePct) >= VPA_PRICE_MOVE_PCT
    && Math.abs(openInterestDeltaPct) >= VPA_OI_DELTA_PCT
    && ((priceMovePct > 0 && openInterestDeltaPct < 0)
      || (priceMovePct < 0 && openInterestDeltaPct > 0));

  if (hasVpaContradiction) {
    return {
      allow: false,
      block: {
        code: "safety_block_vpa",
        symbol,
        attemptedAction: decision.action,
        reason: `${symbol} price and open interest disagree; the move lacks clean participation.`,
        details: { rsi14, priceMovePct, openInterestDeltaPct },
      },
    };
  }

  return { allow: true };
}
