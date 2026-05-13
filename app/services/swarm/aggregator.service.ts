import { db } from "@/lib/db/client";
import { aggregations } from "@/lib/db/schema";
import type { SwarmDecision } from "./swarm-runner.service";

export type AggregatorAction = "open_long" | "open_short" | "close" | "stay";

export type AggregatorOutput = {
  action: AggregatorAction;
  rationale: string;
  regime_assessment: "risk_on" | "neutral" | "risk_off";
  if_open: { asset: string; sizeUsd: number; leverage: number } | null;
  if_close: { asset: string } | null;
  safety: { stop_loss_trigger: string; take_profit_trigger: string };
  dispersion: number;
  swarmSize: number;
  actionCounts: Record<string, number>;
  regimeCounts: Record<string, number>;
  openClusters: Array<{
    asset: string;
    side: "long" | "short";
    count: number;
    avgSizeUsd: number;
    avgLeverage: number;
  }>;
  closeClusters: Array<{ asset: string; count: number }>;
  keyDrivers: string[];
};

function mode<T>(arr: T[]): T {
  const counts = new Map<T, number>();
  for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1);
  let max = -1;
  let modeVal = arr[0];
  for (const [v, n] of counts) if (n > max) { max = n; modeVal = v; }
  return modeVal;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

/**
 * Reduce a swarm's individual perp decisions into a single consensus
 * output plus a dispersion metric. Uses mode for categorical fields and
 * median for size/leverage within the dominant open cluster. Persists to
 * the aggregations table for the cycle trace page.
 */
export async function aggregate(opts: {
  cycleId: string;
  decisions: SwarmDecision[];
}): Promise<AggregatorOutput> {
  const { cycleId, decisions } = opts;
  if (decisions.length === 0) throw new Error("No swarm decisions to aggregate");

  const actionCounts: Record<string, number> = {};
  for (const d of decisions) actionCounts[d.action] = (actionCounts[d.action] ?? 0) + 1;
  const dominantAction = mode(decisions.map((d) => d.action));

  const regimeCounts: Record<string, number> = {};
  for (const d of decisions) regimeCounts[d.regime_assessment] = (regimeCounts[d.regime_assessment] ?? 0) + 1;
  const dominantRegime = mode(decisions.map((d) => d.regime_assessment));

  const openGrouped = new Map<string, SwarmDecision[]>();
  for (const d of decisions) {
    if ((d.action === "open_long" || d.action === "open_short") && d.if_open) {
      const side = d.action === "open_long" ? "long" : "short";
      const k = `${d.if_open.asset.toUpperCase()}__${side}`;
      if (!openGrouped.has(k)) openGrouped.set(k, []);
      openGrouped.get(k)!.push(d);
    }
  }
  const openClusters = Array.from(openGrouped.entries()).map(([k, ds]) => {
    const [asset, side] = k.split("__");
    return {
      asset,
      side: side as "long" | "short",
      count: ds.length,
      avgSizeUsd: median(ds.map((d) => d.if_open!.size_usd)),
      avgLeverage: median(ds.map((d) => d.if_open!.leverage)),
    };
  });
  openClusters.sort((a, b) => b.count - a.count);

  const closeGrouped = new Map<string, number>();
  for (const d of decisions) {
    if (d.action === "close" && d.if_close) {
      const k = d.if_close.asset.toUpperCase();
      closeGrouped.set(k, (closeGrouped.get(k) ?? 0) + 1);
    }
  }
  const closeClusters = Array.from(closeGrouped.entries())
    .map(([asset, count]) => ({ asset, count }))
    .sort((a, b) => b.count - a.count);

  let if_open: AggregatorOutput["if_open"] = null;
  let if_close: AggregatorOutput["if_close"] = null;
  if ((dominantAction === "open_long" || dominantAction === "open_short") && openClusters.length > 0) {
    const wantedSide = dominantAction === "open_long" ? "long" : "short";
    const match = openClusters.find((c) => c.side === wantedSide) ?? openClusters[0];
    if_open = {
      asset: match.asset,
      sizeUsd: Math.round(match.avgSizeUsd * 100) / 100,
      leverage: Math.max(1, Math.round(match.avgLeverage)),
    };
  } else if (dominantAction === "close" && closeClusters.length > 0) {
    if_close = { asset: closeClusters[0].asset };
  }

  const sortedByConfidence = [...decisions].sort((a, b) => (b.confidence ?? 0.5) - (a.confidence ?? 0.5));
  const safety = sortedByConfidence[0].safety;

  const dominantCount = actionCounts[dominantAction] ?? 0;
  const dispersion = 1 - dominantCount / decisions.length;

  const keyDrivers = decisions
    .filter((d) => d.action === dominantAction)
    .slice(0, 3)
    .map((d) => `[${d.personaId}] ${d.rationale}`);

  const rationale = `Swarm of ${decisions.length} converged on "${dominantAction}" (${dominantCount}/${decisions.length}). Regime: ${dominantRegime} (${regimeCounts[dominantRegime]}/${decisions.length}).`;

  const output: AggregatorOutput = {
    action: dominantAction,
    rationale,
    regime_assessment: dominantRegime,
    if_open,
    if_close,
    safety,
    dispersion,
    swarmSize: decisions.length,
    actionCounts,
    regimeCounts,
    openClusters,
    closeClusters,
    keyDrivers,
  };

  await db.insert(aggregations).values({
    cycleId,
    recommendedAllocation: { action: dominantAction, if_open, if_close, regime: dominantRegime } as object,
    dispersion: dispersion.toString(),
    clusterSummary: { actionCounts, regimeCounts, openClusters, closeClusters } as object,
    keyDrivers: keyDrivers as object,
  });

  return output;
}
