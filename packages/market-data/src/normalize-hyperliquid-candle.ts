import type { Candle } from "../../strategy-lab/src";
import type { HyperliquidCandle } from "./types";

export function normalizeHyperliquidCandle(candle: HyperliquidCandle): Candle {
  const normalized = {
    t: candle.t,
    o: Number(candle.o),
    h: Number(candle.h),
    l: Number(candle.l),
    c: Number(candle.c),
    v: Number(candle.v),
  };
  if (
    !Number.isFinite(normalized.t)
    || !Number.isFinite(normalized.o)
    || !Number.isFinite(normalized.h)
    || !Number.isFinite(normalized.l)
    || !Number.isFinite(normalized.c)
    || !Number.isFinite(normalized.v)
  ) {
    throw new Error(`Invalid Hyperliquid candle at ${candle.t}`);
  }
  return normalized;
}
