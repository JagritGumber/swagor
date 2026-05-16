import { db } from "@/lib/db/client";
import { aggregations } from "@/lib/db/schema";
import type { DailyPlanDecision } from "./swarm-runner.service";

export type Bias = "long" | "short" | "avoid" | "neutral";

export type DailyAggregatorOutput = {
  rationale: string;
  regime_assessment: "risk_on" | "neutral" | "risk_off";
  swarmSize: number;
  dispersion: number;                          // 1 - dominantRegimeCount / swarmSize
  biasByAsset: Array<{
    asset: string;
    bias: Bias;                                // mode across personas
    counts: Record<Bias, number>;
    avgConfidence: number;
    keyReasons: string[];                      // top 2-3 oneLineReasons from personas voting the dominant bias
  }>;
  regimeCounts: Record<string, number>;
};

function mode<T extends string>(arr: T[]): T {
  const counts = new Map<T, number>();
  for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1);
  let max = -1;
  let modeVal = arr[0];
  for (const [v, n] of counts) if (n > max) { max = n; modeVal = v; }
  return modeVal;
}

/**
 * Reduce daily-plan swarm decisions into a per-asset bias matrix.
 * For each asset that appears in any persona's perAssetBias array,
 * we compute the modal bias across personas + average confidence
 * + the top 2-3 oneLineReasons from personas that voted the dominant
 * bias. Persists summary to aggregations table for the dev panel.
 */
export async function aggregateDailyPlan(opts: {
  cycleId: string;
  decisions: DailyPlanDecision[];
}): Promise<DailyAggregatorOutput> {
  const { cycleId, decisions } = opts;
  if (decisions.length === 0) throw new Error("No daily-plan decisions to aggregate");

  // Collect votes per asset across all personas.
  const perAsset = new Map<string, Array<{
    bias: Bias; confidence: number; reason: string; personaId: string;
  }>>();
  for (const d of decisions) {
    for (const entry of d.perAssetBias) {
      const asset = entry.asset.toUpperCase();
      if (!perAsset.has(asset)) perAsset.set(asset, []);
      perAsset.get(asset)!.push({
        bias: entry.bias,
        confidence: entry.confidence,
        reason: entry.oneLineReason,
        personaId: d.personaId,
      });
    }
  }

  const biasByAsset: DailyAggregatorOutput["biasByAsset"] = [];
  for (const [asset, votes] of perAsset) {
    const counts: Record<Bias, number> = { long: 0, short: 0, avoid: 0, neutral: 0 };
    for (const v of votes) counts[v.bias]++;
    const biases: Bias[] = votes.map((v) => v.bias);
    const dominantBias = mode(biases);
    const dominantVotes = votes.filter((v) => v.bias === dominantBias);
    const avgConfidence = dominantVotes.length > 0
      ? dominantVotes.reduce((s, v) => s + v.confidence, 0) / dominantVotes.length
      : 0;
    const keyReasons = dominantVotes
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3)
      .map((v) => `[${v.personaId}] ${v.reason}`);
    biasByAsset.push({ asset, bias: dominantBias, counts, avgConfidence, keyReasons });
  }
  biasByAsset.sort((a, b) => a.asset.localeCompare(b.asset));

  // Regime aggregation.
  const regimeCounts: Record<string, number> = {};
  for (const d of decisions) regimeCounts[d.regime_assessment] = (regimeCounts[d.regime_assessment] ?? 0) + 1;
  const dominantRegime = mode(decisions.map((d) => d.regime_assessment));
  const dominantRegimeCount = regimeCounts[dominantRegime] ?? 0;
  const dispersion = 1 - dominantRegimeCount / decisions.length;

  const rationale = `Daily-plan swarm of ${decisions.length}. Regime: ${dominantRegime} (${dominantRegimeCount}/${decisions.length}). ${biasByAsset.length} assets covered.`;

  // Persist a daily-shaped summary into the same aggregations table the
  // tactical pipeline uses. The dev panel reads recommendedAllocation
  // and clusterSummary jsonb.
  await db.insert(aggregations).values({
    cycleId,
    recommendedAllocation: { mode: "daily_plan", regime: dominantRegime, biasByAsset } as object,
    dispersion: dispersion.toString(),
    clusterSummary: { regimeCounts, perAssetCounts: biasByAsset.map((b) => ({ asset: b.asset, counts: b.counts })) } as object,
    keyDrivers: biasByAsset.flatMap((b) => b.keyReasons.slice(0, 1)) as object,
  });

  return { rationale, regime_assessment: dominantRegime, swarmSize: decisions.length, dispersion, biasByAsset, regimeCounts };
}
