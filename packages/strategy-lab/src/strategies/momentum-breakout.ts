import { closeAt } from "../indicators/close-at";
import { enterLong } from "../signals/enter-long";
import { hold } from "../signals/hold";
import { rollingHighAt } from "../indicators/rolling-high-at";
import { smaAt } from "../indicators/sma-at";
import type { Strategy } from "../types";

export const momentumBreakout: Strategy = {
  id: "trend.momentum-breakout",
  label: "Momentum breakout",
  timeframe: "1h",
  warmupCandles: 60,
  evaluate(ctx) {
    const fast = smaAt(ctx.candles, ctx.index, 12);
    const slow = smaAt(ctx.candles, ctx.index, 48);
    const priorHigh = rollingHighAt(ctx.candles, ctx.index - 1, 24);
    const last = closeAt(ctx.candles, ctx.index);
    if (fast === null || slow === null || priorHigh === null || last === null) return hold("not enough trend data");

    if (fast <= slow || last <= priorHigh) return hold("no trend breakout");

    const risk = Math.max(last - slow, last * 0.004);
    return enterLong({
      reason: "trend breakout above recent high",
      riskPct: 0.5,
      stop: last - risk,
      target: last + risk * 2,
    });
  },
};
