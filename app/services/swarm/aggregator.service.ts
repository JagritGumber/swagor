import { db } from "@/lib/db/client";
import { aggregations } from "@/lib/db/schema";
import type { SwarmDecision } from "./swarm-runner.service";

export type AggregatorOutput = {
  decision: "stay" | "rotate" | "harvest";
  rationale: string;
  regime_assessment: "risk_on" | "neutral" | "risk_off";
  if_rotate: { from: string; to: string; percent_of_portfolio: number } | null;
  safety_layer: {
    stop_loss_trigger: string;
    take_profit_trigger: string;
    rebalance_trigger: string;
  };
  dispersion: number;
  swarmSize: number;
  decisionCounts: Record<string, number>;
  regimeCounts: Record<string, number>;
  rotateClusters: Array<{ from: string; to: string; count: number; avgPercent: number }>;
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
 * Reduce a swarm's individual decisions into a single consensus output
 * + dispersion metric. Uses mode for categorical fields (decision, regime),
 * median percent within the dominant rotate cluster, and inherits the
 * highest-confidence member's safety_layer.
 *
 * Persists to aggregations table for the cycle trace page to show.
 */
export async function aggregate(opts: {
  cycleId: string;
  decisions: SwarmDecision[];
}): Promise<AggregatorOutput> {
  const { cycleId, decisions } = opts;
  if (decisions.length === 0) throw new Error("No swarm decisions to aggregate");

  const decisionCounts: Record<string, number> = {};
  for (const d of decisions) decisionCounts[d.decision] = (decisionCounts[d.decision] ?? 0) + 1;
  const dominantDecision = mode(decisions.map((d) => d.decision));

  const regimeCounts: Record<string, number> = {};
  for (const d of decisions) regimeCounts[d.regime_assessment] = (regimeCounts[d.regime_assessment] ?? 0) + 1;
  const dominantRegime = mode(decisions.map((d) => d.regime_assessment));

  const rotateClusters: Array<{ from: string; to: string; count: number; avgPercent: number }> = [];
  const grouped = new Map<string, SwarmDecision[]>();
  for (const d of decisions.filter((x) => x.decision === "rotate" && x.if_rotate)) {
    const k = `${d.if_rotate!.from}__${d.if_rotate!.to}`;
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(d);
  }
  for (const [k, ds] of grouped) {
    const [from, to] = k.split("__");
    rotateClusters.push({
      from,
      to,
      count: ds.length,
      avgPercent: median(ds.map((d) => d.if_rotate!.percent_of_portfolio)),
    });
  }
  rotateClusters.sort((a, b) => b.count - a.count);

  let if_rotate: AggregatorOutput["if_rotate"] = null;
  if (dominantDecision === "rotate" && rotateClusters.length > 0) {
    const top = rotateClusters[0];
    if_rotate = { from: top.from, to: top.to, percent_of_portfolio: Math.round(top.avgPercent) };
  }

  const sortedByConfidence = [...decisions].sort((a, b) => (b.confidence ?? 0.5) - (a.confidence ?? 0.5));
  const safety_layer = sortedByConfidence[0].safety_layer;

  const dominantCount = decisionCounts[dominantDecision] ?? 0;
  const dispersion = 1 - dominantCount / decisions.length;

  const keyDrivers = decisions
    .filter((d) => d.decision === dominantDecision)
    .slice(0, 3)
    .map((d) => `[${d.personaId}] ${d.rationale}`);

  const rationale = `Swarm of ${decisions.length} converged on "${dominantDecision}" (${dominantCount}/${decisions.length}). Regime: ${dominantRegime} (${regimeCounts[dominantRegime]}/${decisions.length}).`;

  const output: AggregatorOutput = {
    decision: dominantDecision,
    rationale,
    regime_assessment: dominantRegime,
    if_rotate,
    safety_layer,
    dispersion,
    swarmSize: decisions.length,
    decisionCounts,
    regimeCounts,
    rotateClusters,
    keyDrivers,
  };

  await db.insert(aggregations).values({
    cycleId,
    recommendedAllocation: { decision: dominantDecision, if_rotate, regime: dominantRegime } as object,
    dispersion: dispersion.toString(),
    clusterSummary: { decisionCounts, regimeCounts, rotateClusters } as object,
    keyDrivers: keyDrivers as object,
  });

  return output;
}
