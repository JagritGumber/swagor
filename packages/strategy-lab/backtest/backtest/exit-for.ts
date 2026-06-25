import type { Candle, OpenTrade, Trade } from "../../types";

export function exitFor(open: OpenTrade, candle: Candle): { price: number; reason: Trade["exitReason"] } | null {
  if (open.side === "long") {
    if (candle.l <= open.stop) return { price: open.stop, reason: "stop" };
    if (candle.h >= open.target) return { price: open.target, reason: "target" };
  } else {
    if (candle.h >= open.stop) return { price: open.stop, reason: "stop" };
    if (candle.l <= open.target) return { price: open.target, reason: "target" };
  }
  return null;
}


