import type { PriceLevel } from "./types";

export function nearestPriceLevel(input: {
  levels: PriceLevel[];
  price: number;
  maxDistancePct: number;
}): PriceLevel | null {
  let best: PriceLevel | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const level of input.levels) {
    const distance = Math.abs(level.price - input.price) / input.price;
    if (distance <= input.maxDistancePct && distance < bestDistance) {
      best = level;
      bestDistance = distance;
    }
  }
  return best;
}
