import type { Candle } from "../../shared/types";
import type { PriceLevel } from "../../shared/market/metrics";

export function detectSwings(candles: Candle[], left: number, right: number): Array<{ price: number; time: number }> {
  const swings: Array<{ price: number; time: number }> = [];
  for (let i = left; i < candles.length - right; i++) {
    const high = candles[i].h;
    let isSwing = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j !== i && candles[j].h >= high) {
        isSwing = false;
        break;
      }
    }
    if (isSwing) swings.push({ price: high, time: candles[i].t });
  }
  for (let i = left; i < candles.length - right; i++) {
    const low = candles[i].l;
    let isSwing = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j !== i && candles[j].l <= low) {
        isSwing = false;
        break;
      }
    }
    if (isSwing) swings.push({ price: low, time: candles[i].t });
  }
  return swings;
}

export function clusterLevels(
  swings: Array<{ price: number; time: number }>,
  tolerancePct: number,
  minTouches: number,
): PriceLevel[] {
  const sorted = [...swings].sort((a, b) => a.price - b.price);
  const clusters: Array<{ prices: number[]; times: number[] }> = [];

  for (const swing of sorted) {
    const lastCluster = clusters[clusters.length - 1];
    if (
      lastCluster &&
      Math.abs(swing.price - lastCluster.prices[lastCluster.prices.length - 1]) / lastCluster.prices[lastCluster.prices.length - 1] <= tolerancePct
    ) {
      lastCluster.prices.push(swing.price);
      lastCluster.times.push(swing.time);
    } else {
      clusters.push({ prices: [swing.price], times: [swing.time] });
    }
  }

  return clusters
    .filter((c) => c.prices.length >= minTouches)
    .map((c) => {
      const avgPrice = c.prices.reduce((s, p) => s + p, 0) / c.prices.length;
      const maxPrice = Math.max(...c.prices);
      return {
        price: avgPrice,
        kind: c.prices.some((p) => p === maxPrice) ? ("resistance" as const) : ("support" as const),
        touches: c.prices.length,
        lastTouchedAt: Math.max(...c.times),
      };
    });
}

export function updateLevels(
  existingLevels: PriceLevel[],
  newSwings: Array<{ price: number; time: number }>,
  tolerancePct: number,
  minTouches: number,
): PriceLevel[] {
  const allSwings = [
    ...existingLevels.flatMap((l) =>
      Array.from({ length: l.touches }, () => ({
        price: l.price,
        time: l.lastTouchedAt,
      })),
    ),
    ...newSwings,
  ];
  return clusterLevels(allSwings, tolerancePct, minTouches);
}
