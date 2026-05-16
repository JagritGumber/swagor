/**
 * Volume profile + swing levels computed from candle data. Pure
 * function, no IO. Feeds the swarm + plan-compiler with the price
 * levels real traders actually anchor on (POC, VAH, VAL, VWAP,
 * recent swing high/low) instead of just EMAs.
 *
 * Inputs: an OHLCV candle window. 120 5m bars = last 10 hours,
 * which is what marketFeatures gives us anyway. Resolution: 50
 * price buckets across the high-low range. Value area: 70% of
 * total volume, expanded outward from POC.
 */

export type Candle = { o: number; h: number; l: number; c: number; v: number };

export type VolumeProfile = {
  vwap: number | null;
  poc: number | null;
  vah: number | null;
  val: number | null;
  swingHigh: number | null;
  swingLow: number | null;
  totalVolume: number;
};

const NULL_PROFILE: VolumeProfile = {
  vwap: null, poc: null, vah: null, val: null,
  swingHigh: null, swingLow: null, totalVolume: 0,
};

const BUCKETS = 50;
const VALUE_AREA_PCT = 0.7;

export function computeVolumeProfile(candles: Candle[]): VolumeProfile {
  if (candles.length === 0) return NULL_PROFILE;

  let totalVolume = 0;
  let vwapNumerator = 0;
  let swingHigh = -Infinity;
  let swingLow = Infinity;
  for (const c of candles) {
    if (!Number.isFinite(c.v) || c.v <= 0) continue;
    const tp = (c.h + c.l + c.c) / 3;
    totalVolume += c.v;
    vwapNumerator += tp * c.v;
    if (c.h > swingHigh) swingHigh = c.h;
    if (c.l < swingLow) swingLow = c.l;
  }
  if (totalVolume <= 0 || !Number.isFinite(swingHigh) || !Number.isFinite(swingLow)) {
    return NULL_PROFILE;
  }
  const vwap = vwapNumerator / totalVolume;

  const range = swingHigh - swingLow;
  if (range <= 0) {
    return { ...NULL_PROFILE, vwap, swingHigh, swingLow, totalVolume };
  }
  const bucketSize = range / BUCKETS;
  const buckets = new Array<number>(BUCKETS).fill(0);
  for (const c of candles) {
    if (!Number.isFinite(c.v) || c.v <= 0) continue;
    const tp = (c.h + c.l + c.c) / 3;
    const idx = Math.min(BUCKETS - 1, Math.max(0, Math.floor((tp - swingLow) / bucketSize)));
    buckets[idx] = (buckets[idx] ?? 0) + c.v;
  }
  let pocIdx = 0;
  let pocVol = 0;
  for (let i = 0; i < BUCKETS; i++) {
    const v = buckets[i] ?? 0;
    if (v > pocVol) { pocVol = v; pocIdx = i; }
  }
  const target = totalVolume * VALUE_AREA_PCT;
  let captured = pocVol;
  let lo = pocIdx;
  let hi = pocIdx;
  while (captured < target && (lo > 0 || hi < BUCKETS - 1)) {
    const next = (lo > 0 ? buckets[lo - 1] ?? 0 : -1);
    const prev = (hi < BUCKETS - 1 ? buckets[hi + 1] ?? 0 : -1);
    if (next === -1 && prev === -1) break;
    if (next >= prev) { lo -= 1; captured += next; }
    else { hi += 1; captured += prev; }
  }
  return {
    vwap, poc: swingLow + (pocIdx + 0.5) * bucketSize,
    val: swingLow + lo * bucketSize,
    vah: swingLow + (hi + 1) * bucketSize,
    swingHigh, swingLow, totalVolume,
  };
}
