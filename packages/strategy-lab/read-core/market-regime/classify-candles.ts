import type { Candle } from "@strategy-lab/types";
import type { ReaderMarketRegime, ReaderMarketRegimeMode } from "./types";

const MIN_CANDLES = 12;
const HIGH_VOL_RANGE_PCT = 0.025;
const TREND_DRIFT_PCT = 0.01;
const TREND_EFFICIENCY = 0.42;

export function classifyCandles(candles: Candle[]): ReaderMarketRegime {
  if (candles.length < MIN_CANDLES) {
    return regime("unknown", false, 0, 0, 0, "not enough candles");
  }

  const first = candles[0];
  let high = Number.NEGATIVE_INFINITY;
  let low = Number.POSITIVE_INFINITY;
  for (const c of candles) {
    if (c.h > high) high = c.h;
    if (c.l < low) low = c.l;
  }
  const open = first.o;
  const close = candles[candles.length - 1].c;

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
      "drift is directional versus total range",
    );
  }
  if (highVol) {
    return regime("high-vol", true, rangePct, driftPct, directionalEfficiency, "range is expanded");
  }
  return regime("range", false, rangePct, driftPct, directionalEfficiency, "range is contained");
}

function regime(
  mode: ReaderMarketRegimeMode,
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
