import type { PriceLocation, VolumeProfile, PriceLevel } from "../../shared/market/metrics";

export function classifyPriceLocation(
  price: number,
  profile: VolumeProfile | null,
  nearestLevel: PriceLevel | null,
): PriceLocation {
  if (!profile) return "outside-profile";

  if (price < profile.low) return "below-value";
  if (price > profile.high) return "above-value";

  if (nearestLevel && Math.abs(price - nearestLevel.price) / nearestLevel.price < 0.003) {
    if (nearestLevel.kind === "support" && price <= profile.valueAreaLow) return "value-low";
    if (nearestLevel.kind === "resistance" && price >= profile.valueAreaHigh) return "value-high";
  }

  const nearPoc = Math.abs(price - profile.poc) / profile.poc < 0.002;
  if (nearPoc) return "near-poc";

  if (price <= profile.valueAreaLow) return "value-low";
  if (price >= profile.valueAreaHigh) return "value-high";

  return "near-poc";
}

export function findNearestLevel(price: number, levels: PriceLevel[]): PriceLevel | null {
  if (levels.length === 0) return null;
  let nearest = levels[0];
  let minDist = Math.abs(price - nearest.price);
  for (let i = 1; i < levels.length; i++) {
    const dist = Math.abs(price - levels[i].price);
    if (dist < minDist) {
      minDist = dist;
      nearest = levels[i];
    }
  }
  return nearest;
}
