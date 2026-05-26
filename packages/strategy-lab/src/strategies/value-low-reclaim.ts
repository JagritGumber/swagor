import { atr } from "../indicators/atr";
import { closes } from "../indicators/closes";
import { crossedAbove } from "../indicators/crossed-above";
import { enterLong } from "../signals/enter-long";
import { hold } from "../signals/hold";
import { rollingLow } from "../indicators/rolling-low";
import type { Strategy } from "../types";

export const valueLowReclaim: Strategy = {
  id: "mean-reversion.value-low-reclaim",
  label: "Value low reclaim",
  timeframe: "5m",
  warmupCandles: 24,
  evaluate(ctx) {
    const recent = ctx.candles.slice(-24);
    const valueLow = rollingLow(recent, 20);
    const currentAtr = atr(ctx.candles, 14);
    if (valueLow === null || currentAtr === null) return hold("not enough structure");
    if (!crossedAbove(closes(ctx.candles), valueLow)) return hold("no value-low reclaim");

    const last = ctx.candles[ctx.candles.length - 1].c;
    return enterLong({
      reason: "value low reclaim",
      riskPct: 0.35,
      stop: valueLow - currentAtr * 0.25,
      target: last + currentAtr * 0.9,
    });
  },
};
