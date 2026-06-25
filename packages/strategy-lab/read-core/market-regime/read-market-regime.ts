import type { Candle } from "../../types";
import type { ReaderMarketRegime } from "./types";

const MIN_CANDLES = 12;
const HIGH_VOL_RANGE_PCT = 0.025;
const TREND_DRIFT_PCT = 0.01;
const TREND_EFFICIENCY = 0.42;

export function readMarketRegime(input: {
  candles: Candle[];
  now: number;
}): ReaderMarketRegime {
  const session = currentUtcDayStats(input.candles, input.now);
  if (session.count < MIN_CANDLES) {
    return regime("unknown", false, 0, 0, 0, "not enough current-session candles");
  }

  const rangePct = session.open > 0 ? (session.high - session.low) / session.open : 0;
  const driftPct = session.open > 0 ? (session.close - session.open) / session.open : 0;
  const directionalEfficiency = rangePct > 0 ? Math.abs(driftPct) / rangePct : 0;
  const highVol = rangePct >= HIGH_VOL_RANGE_PCT;

  if (Math.abs(driftPct) >= TREND_DRIFT_PCT && directionalEfficiency >= TREND_EFFICIENCY) {
    return regime(
      driftPct > 0 ? "trend-up" : "trend-down",
      highVol,
      rangePct,
      driftPct,
      directionalEfficiency,
      "session drift is directional versus total range",
    );
  }
  if (highVol) {
    return regime("high-vol", true, rangePct, driftPct, directionalEfficiency, "session range is expanded");
  }
  return regime("range", false, rangePct, driftPct, directionalEfficiency, "session range is contained");
}

function currentUtcDayStats(candles: Candle[], now: number): {
  count: number;
  open: number;
  high: number;
  low: number;
  close: number;
} {
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const start = dayStart.getTime();
  let count = 0;
  let open = 0;
  let high = Number.NEGATIVE_INFINITY;
  let low = Number.POSITIVE_INFINITY;
  let close = 0;
  for (const candle of candles) {
    if (candle.t < start || candle.t > now) continue;
    if (count === 0) open = candle.o;
    high = Math.max(high, candle.h);
    low = Math.min(low, candle.l);
    close = candle.c;
    count += 1;
  }
  return { count, open, high, low, close };
}

function regime(
  mode: ReaderMarketRegime["mode"],
  highVol: boolean,
  rangePct: number,
  driftPct: number,
  directionalEfficiency: number,
  reason: string,
): ReaderMarketRegime {
  return {
    mode,
    highVol,
    rangePct: round(rangePct),
    driftPct: round(driftPct),
    directionalEfficiency: round(directionalEfficiency),
    reason,
  };
}

function round(value: number): number {
  return Number(value.toFixed(6));
}

