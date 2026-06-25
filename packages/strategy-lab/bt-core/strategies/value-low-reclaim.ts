import { atrAt } from "../indicators/atr-at";
import { closeAt } from "../indicators/close-at";
import { crossedAboveAt } from "../indicators/crossed-above-at";
import { enterLong } from "../signals/enter-long";
import { hold } from "../signals/hold";
import { rollingLowAt } from "../indicators/rolling-low-at";
import type { Strategy } from "../../types";

export const valueLowReclaim: Strategy = {
  id: "mean-reversion.value-low-reclaim",
  label: "Value low reclaim",
  timeframe: "5m",
  warmupCandles: 24,
  evaluate(ctx) {
    const valueLow = rollingLowAt(ctx.candles, ctx.index, 20);
    const currentAtr = atrAt(ctx.candles, ctx.index, 14);
    const last = closeAt(ctx.candles, ctx.index);
    if (valueLow === null || currentAtr === null || last === null) return hold("not enough structure");
    if (!crossedAboveAt(ctx.candles, ctx.index, valueLow)) return hold("no value-low reclaim");

    return enterLong({
      reason: "value low reclaim",
      riskPct: 0.35,
      stop: valueLow - currentAtr * 0.25,
      target: last + currentAtr * 0.9,
    });
  },
};

