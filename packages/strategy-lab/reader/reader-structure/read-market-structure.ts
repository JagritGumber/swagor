import type { OrderflowBucket } from "@market-data/parquet/types";
import type { VolumeProfileBucket } from "@market-data/parquet/types";
import { parseVolumeProfileStructure, type VolumeNode, type VolumeProfileStructure } from "@strategy-lab/read-core/read/parse-volume-profile-structure";
import { calculateCvd, type CvdRead } from "@strategy-lab/read-core/orderflow/calculate-cvd";
import type { MarketStructureAction, MarketStructureLocation, MarketStructureRead } from "./types";

export function readMarketStructure(input: {
  asset: string;
  timestampMs: number;
  profileBuckets: VolumeProfileBucket[];
  orderflowBuckets: OrderflowBucket[];
  price: number;
}): MarketStructureRead {
  const structure = parseVolumeProfileStructure({ buckets: input.profileBuckets });
  const cvd = calculateCvd(input.orderflowBuckets);

  const location = classifyLocation(input.price, structure);
  const nearestNode = findNearestNode(input.price, structure);
  const absorption = detectAbsorption(input.orderflowBuckets);
  const action = classifyAction(location, cvd, absorption, nearestNode);

  return {
    asset: input.asset,
    timestampMs: input.timestampMs,
    structure,
    cvd,
    location,
    action,
    nearestNode,
    absorption,
    narrative: buildNarrative(location, action, cvd, nearestNode, absorption),
  };
}

function classifyLocation(price: number, structure: VolumeProfileStructure | null): MarketStructureLocation {
  if (!structure) return "unknown";

  const binSize = structure.bins[0] ? structure.bins[0].high - structure.bins[0].low : 0;
  if (Math.abs(price - structure.poc) < binSize) {
    return "at-poc";
  }

  const hvnNear = structure.hvn.find(
    (n: VolumeNode) => price >= n.low && price <= n.high,
  );
  if (hvnNear) return "at-hvn";

  const lvnNear = structure.lvn.find(
    (n: VolumeNode) => price >= n.low && price <= n.high,
  );
  if (lvnNear) return "at-lvn";

  if (price > structure.valueAreaHigh) return "above-value";
  if (price < structure.valueAreaLow) return "below-value";

  return "inside-value";
}

function findNearestNode(price: number, structure: VolumeProfileStructure | null): VolumeNode | null {
  if (!structure) return null;

  const allNodes = [...structure.hvn, ...structure.lvn].sort(
    (a: VolumeNode, b: VolumeNode) => Math.abs(price - a.mid) - Math.abs(price - b.mid),
  );
  return allNodes[0] ?? null;
}

function detectAbsorption(buckets: OrderflowBucket[]): boolean {
  if (buckets.length < 3) return false;
  const recent = buckets.slice(-5);
  const totalDelta = recent.reduce((sum, b) => sum + Math.abs(b.delta), 0);
  const totalRange = recent.reduce((sum, b) => sum + (b.high - b.low), 0);
  const avgDelta = totalDelta / recent.length;
  const avgRange = totalRange / recent.length;

  return avgDelta > 0 && avgRange > 0 && avgDelta / avgRange > 0.5;
}

function classifyAction(
  location: MarketStructureLocation,
  cvd: CvdRead | null,
  absorption: boolean,
  _nearestNode: VolumeNode | null,
): MarketStructureAction {
  if (location === "at-lvn") {
    if (absorption) return "rejecting";
    if (cvd && cvd.cvdTrend === "rising") return "discovering";
    if (cvd && cvd.cvdTrend === "falling") return "discovering";
    return "rotating";
  }

  if (location === "at-hvn") {
    if (absorption) return "accepting";
    if (cvd && cvd.cvdTrend !== "flat") return "rotating";
    return "accepting";
  }

  if (location === "at-poc") {
    return "rotating";
  }

  if (location === "above-value" || location === "below-value") {
    if (absorption) return "rejecting";
    if (cvd && cvd.priceCvdDivergence === "bearish") return "rejecting";
    if (cvd && cvd.priceCvdDivergence === "bullish") return "rejecting";
    return "discovering";
  }

  return "unknown";
}

function buildNarrative(
  location: MarketStructureLocation,
  action: MarketStructureAction,
  cvd: CvdRead | null,
  _nearestNode: VolumeNode | null,
  absorption: boolean,
): string {
  const parts: string[] = [];

  if (location === "at-hvn") {
    parts.push("Price is at a high volume node (accepted value)");
  } else if (location === "at-lvn") {
    parts.push("Price is at a low volume node (discovery zone)");
  } else if (location === "at-poc") {
    parts.push("Price is at the point of control");
  } else if (location === "above-value") {
    parts.push("Price is above the value area");
  } else if (location === "below-value") {
    parts.push("Price is below the value area");
  } else {
    parts.push("Price is inside the value area");
  }

  if (action === "accepting") {
    parts.push("Market is accepting price here");
  } else if (action === "rejecting") {
    parts.push("Market is rejecting price here");
  } else if (action === "discovering") {
    parts.push("Market is in price discovery");
  } else if (action === "rotating") {
    parts.push("Market is rotating");
  }

  if (absorption) {
    parts.push("Absorption detected (large orders being absorbed)");
  }

  if (cvd) {
    if (cvd.priceCvdDivergence === "bullish") {
      parts.push("CVD divergence: price down but buying pressure");
    } else if (cvd.priceCvdDivergence === "bearish") {
      parts.push("CVD divergence: price up but selling pressure");
    }
  }

  return parts.join(". ") + ".";
}
