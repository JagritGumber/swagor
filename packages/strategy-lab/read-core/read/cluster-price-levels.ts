import type { PriceLevel } from "./types";

type Swing = {
  price: number;
  time: number;
};

type Cluster = {
  kind: "support" | "resistance";
  priceSum: number;
  touches: number;
  firstTouchedAt: number;
  lastTouchedAt: number;
};

export function clusterPriceLevels(input: {
  supports: Swing[];
  resistances: Swing[];
  tolerancePct: number;
  minTouches: number;
}): PriceLevel[] {
  const clusters: Cluster[] = [];
  addSwings(clusters, "support", input.supports, input.tolerancePct);
  addSwings(clusters, "resistance", input.resistances, input.tolerancePct);
  return clusters
    .filter((cluster) => cluster.touches >= input.minTouches)
    .map((cluster) => ({
      kind: cluster.kind,
      price: cluster.priceSum / cluster.touches,
      touches: cluster.touches,
      firstTouchedAt: cluster.firstTouchedAt,
      lastTouchedAt: cluster.lastTouchedAt,
    }))
    .sort((a, b) => b.touches - a.touches || b.lastTouchedAt - a.lastTouchedAt);
}

function addSwings(clusters: Cluster[], kind: "support" | "resistance", swings: Swing[], tolerancePct: number): void {
  for (const swing of swings) {
    const cluster = findCluster(clusters, kind, swing.price, tolerancePct);
    if (!cluster) {
      clusters.push({
        kind,
        priceSum: swing.price,
        touches: 1,
        firstTouchedAt: swing.time,
        lastTouchedAt: swing.time,
      });
      continue;
    }
    cluster.priceSum += swing.price;
    cluster.touches += 1;
    if (swing.time < cluster.firstTouchedAt) cluster.firstTouchedAt = swing.time;
    if (swing.time > cluster.lastTouchedAt) cluster.lastTouchedAt = swing.time;
  }
}

function findCluster(
  clusters: Cluster[],
  kind: "support" | "resistance",
  price: number,
  tolerancePct: number,
): Cluster | null {
  for (const cluster of clusters) {
    if (cluster.kind !== kind) continue;
    const clusterPrice = cluster.priceSum / cluster.touches;
    const distancePct = Math.abs(price - clusterPrice) / clusterPrice;
    if (distancePct <= tolerancePct) return cluster;
  }
  return null;
}

