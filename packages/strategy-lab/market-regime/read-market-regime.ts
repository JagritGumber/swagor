import type { Candle } from "../types";
import type { ReaderMarketRegime } from "./types";

const MIN_CANDLES = 12;
const HIGH_VOL_RANGE_PCT = 0.025;
const TREND_DRIFT_PCT = 0.01;
const TREND_EFFICIENCY = 0.42;

export function readMarketRegime(input: {
  candles: Candle[];
  now: number;
}): ReaderMarketRegime {
  const sessionCandles = currentUtcDayCandles(input.candles, input.now);
  if (sessionCandles.length < MIN_CANDLES) {
    return regime("unknown", false, 0, 0, 0, "not enough current-session candles");
  }

  const open = sessionCandles[0].o;
  const close = sessionCandles[sessionCandles.length - 1].c;
  const high = Math.max(...sessionCandles.map((candle) => candle.h));
  const low = Math.min(...sessionCandles.map((candle) => candle.l));
  const rangePct = open > 0 ? (high - low) / open : 0;
  const driftPct = open > 0 ? (close - open) / open : 0;
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

function currentUtcDayCandles(candles: Candle[], now: number): Candle[] {
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const start = dayStart.getTime();
  return candles.filter((candle) => candle.t >= start && candle.t <= now);
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
