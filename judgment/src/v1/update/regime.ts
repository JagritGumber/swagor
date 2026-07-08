import type { Candle } from "../../shared/types";
import type { RegimeMetrics } from "../../shared/market/metrics";

const MIN_CANDLES = 12;
const HIGH_VOL_RANGE_PCT = 0.025;
const TREND_DRIFT_PCT = 0.01;
const TREND_EFFICIENCY = 0.42;

export function computeRegime(candles: Candle[]): RegimeMetrics {
  if (candles.length < MIN_CANDLES) {
    return { mode: "unknown", highVol: false, rangePct: 0, driftPct: 0, directionalEfficiency: 0 };
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

  let mode: RegimeMetrics["mode"];
  if (Math.abs(driftPct) >= TREND_DRIFT_PCT && directionalEfficiency >= TREND_EFFICIENCY) {
    mode = driftPct > 0 ? "trend-up" : "trend-down";
  } else if (highVol) {
    mode = "high-vol";
  } else {
    mode = "range";
  }

  return {
    mode,
    highVol,
    rangePct: round(rangePct),
    driftPct: round(driftPct),
    directionalEfficiency: round(directionalEfficiency),
  };
}

export function slideRegimeWindow(candles: Candle[], windowMs: number, newCandleAt: number): Candle[] {
  const cutoff = newCandleAt - windowMs;
  let start = 0;
  while (start < candles.length && candles[start].t < cutoff) {
    start++;
  }
  return candles.slice(start);
}

function round(value: number): number {
  return Number(value.toFixed(6));
}
