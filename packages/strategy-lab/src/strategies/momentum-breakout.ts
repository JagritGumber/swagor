import { closes } from "../indicators/closes";
import { enterLong } from "../signals/enter-long";
import { hold } from "../signals/hold";
import { rollingHigh } from "../indicators/rolling-high";
import { sma } from "../indicators/sma";
import type { Strategy } from "../types";

export const momentumBreakout: Strategy = {
  id: "trend.momentum-breakout",
  label: "Momentum breakout",
  timeframe: "1h",
  warmupCandles: 60,
  evaluate(ctx) {
    const closeValues = closes(ctx.candles);
    const fast = sma(closeValues, 12);
    const slow = sma(closeValues, 48);
    const priorHigh = rollingHigh(ctx.candles.slice(0, -1), 24);
    if (fast === null || slow === null || priorHigh === null) return hold("not enough trend data");

    const last = closeValues[closeValues.length - 1];
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
