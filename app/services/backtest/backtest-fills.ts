import type { Candle } from "@/lib/data-sources/hyperliquid";

/**
 * Realistic backtest fills. A decision is made on the candle you can see (its
 * close), but you cannot trade that candle - you fill at the OPEN of the next
 * candle, with adverse slippage. This avoids same-candle look-ahead and models
 * how a real signal -> order -> fill actually lands.
 */
const SLIPPAGE = 0.0005; // 5 bps, applied against you on every fill

export function nextCandleAfter(candles: Candle[], tMs: number): Candle | null {
  return candles.find((c) => c.t > tMs) ?? null;
}

/** Entry fill: long pays up, short sells down. */
export function entryFill(side: "long" | "short", nextOpen: number): number {
  return side === "long" ? nextOpen * (1 + SLIPPAGE) : nextOpen * (1 - SLIPPAGE);
}

/** Exit fill: closing a long sells lower, closing a short buys back higher. */
export function exitFill(side: "long" | "short", nextOpen: number): number {
  return side === "long" ? nextOpen * (1 - SLIPPAGE) : nextOpen * (1 + SLIPPAGE);
}
