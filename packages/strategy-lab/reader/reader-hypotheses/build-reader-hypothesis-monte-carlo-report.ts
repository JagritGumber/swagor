import type { ReaderCandidate } from "../reader-candidates/types";
import { evaluateReaderHypothesis } from "./evaluate-reader-hypotheses";
import type { ReaderHypothesis, ReaderHypothesisEvaluationOptions, ReaderHypothesisSummary } from "./types";

const dayMs = 24 * 60 * 60 * 1000;

export type ReaderHypothesisMonteCarloOptions = ReaderHypothesisEvaluationOptions & {
  samples?: number;
  seed?: number;
  percentile?: number;
  ruinDrawdownR?: number;
};

export type ReaderHypothesisMonteCarloPathStats = {
  samples: number;
  percentile: number;
  medianTotalR: number;
  totalRP05: number;
  totalRP95: number;
  positiveReturnProbability: number;
  medianMaxDrawdownR: number;
  maxDrawdownP05R: number;
  maxDrawdownP95R: number;
  ruinProbability: number;
  medianLongestLosingStreak: number;
  longestLosingStreakP95: number;
};

export type ReaderHypothesisMonteCarloResult = {
  hypothesis: ReaderHypothesis;
  summary: ReaderHypothesisSummary;
  entries: number;
  evaluatedDays: number;
  tradeOrder: ReaderHypothesisMonteCarloPathStats;
  dayBlock: ReaderHypothesisMonteCarloPathStats;
};

export type ReaderHypothesisMonteCarloReport = {
  summary: {
    candidates: number;
    hypotheses: number;
    roundTripCostBps: number;
    samples: number;
    seed: number;
    percentile: number;
    ruinDrawdownR: number;
  };
  ranked: ReaderHypothesisMonteCarloResult[];
};

export function buildReaderHypothesisMonteCarloReport(input: {
  candidates: ReaderCandidate[];
  hypotheses: ReaderHypothesis[];
  options?: ReaderHypothesisMonteCarloOptions;
}): ReaderHypothesisMonteCarloReport {
  const options = normalizedOptions(input.options ?? {});
  const evaluatedDays = daysInCandidateRange(input.candidates);
  const ranked = input.hypotheses.map((hypothesis, index) => {
    const result = evaluateReaderHypothesis({
      candidates: input.candidates,
      hypothesis,
      options,
    });
    const tradeReturns = result.entries.map((entry) => entry.resultR);
    const dailyReturns = dailyReturnsFor(result.entries, evaluatedDays, input.candidates);
    return {
      hypothesis,
      summary: result.summary,
      entries: result.entries.length,
      evaluatedDays,
      tradeOrder: simulatePaths({
        returns: tradeReturns,
        samples: options.samples,
        seed: options.seed + index * 10_003,
        percentile: options.percentile,
        ruinDrawdownR: options.ruinDrawdownR,
      }),
      dayBlock: simulatePaths({
        returns: dailyReturns,
        samples: options.samples,
        seed: options.seed + index * 10_003 + 1_001,
        percentile: options.percentile,
        ruinDrawdownR: options.ruinDrawdownR,
      }),
    };
  }).sort((left, right) =>
    right.dayBlock.positiveReturnProbability - left.dayBlock.positiveReturnProbability
    || right.dayBlock.maxDrawdownP05R - left.dayBlock.maxDrawdownP05R
    || right.tradeOrder.maxDrawdownP05R - left.tradeOrder.maxDrawdownP05R
    || right.dayBlock.totalRP05 - left.dayBlock.totalRP05
    || right.summary.totalR - left.summary.totalR
  );

  return {
    summary: {
      candidates: input.candidates.length,
      hypotheses: input.hypotheses.length,
      roundTripCostBps: options.roundTripCostBps,
      samples: options.samples,
      seed: options.seed,
      percentile: options.percentile,
      ruinDrawdownR: options.ruinDrawdownR,
    },
    ranked,
  };
}

function simulatePaths(input: {
  returns: number[];
  samples: number;
  seed: number;
  percentile: number;
  ruinDrawdownR: number;
}): ReaderHypothesisMonteCarloPathStats {
  if (input.returns.length === 0) {
    return {
      samples: 0,
      percentile: input.percentile,
      medianTotalR: 0,
      totalRP05: 0,
      totalRP95: 0,
      positiveReturnProbability: 0,
      medianMaxDrawdownR: 0,
      maxDrawdownP05R: 0,
      maxDrawdownP95R: 0,
      ruinProbability: 0,
      medianLongestLosingStreak: 0,
      longestLosingStreakP95: 0,
    };
  }
  const random = seededRandom(input.seed);
  const totals: number[] = [];
  const maxDrawdowns: number[] = [];
  const losingStreaks: number[] = [];
  let positive = 0;
  let ruined = 0;

  for (let sample = 0; sample < input.samples; sample += 1) {
    let total = 0;
    let equity = 0;
    let peak = 0;
    let maxDrawdown = 0;
    let currentLosses = 0;
    let longestLosses = 0;
    for (let index = 0; index < input.returns.length; index += 1) {
      const value = input.returns[Math.floor(random() * input.returns.length)] ?? 0;
      total += value;
      equity += value;
      peak = Math.max(peak, equity);
      maxDrawdown = Math.min(maxDrawdown, equity - peak);
      if (value < 0) {
        currentLosses += 1;
        longestLosses = Math.max(longestLosses, currentLosses);
      } else {
        currentLosses = 0;
      }
    }
    totals.push(total);
    maxDrawdowns.push(maxDrawdown);
    losingStreaks.push(longestLosses);
    if (total > 0) positive += 1;
    if (maxDrawdown <= input.ruinDrawdownR) ruined += 1;
  }

  return {
    samples: input.samples,
    percentile: input.percentile,
    medianTotalR: round(percentile(totals, 0.5)),
    totalRP05: round(percentile(totals, input.percentile)),
    totalRP95: round(percentile(totals, 1 - input.percentile)),
    positiveReturnProbability: round(positive / input.samples),
    medianMaxDrawdownR: round(percentile(maxDrawdowns, 0.5)),
    maxDrawdownP05R: round(percentile(maxDrawdowns, input.percentile)),
    maxDrawdownP95R: round(percentile(maxDrawdowns, 1 - input.percentile)),
    ruinProbability: round(ruined / input.samples),
    medianLongestLosingStreak: round(percentile(losingStreaks, 0.5)),
    longestLosingStreakP95: round(percentile(losingStreaks, 1 - input.percentile)),
  };
}

function dailyReturnsFor(
  entries: Array<{ candidate: ReaderCandidate; resultR: number }>,
  evaluatedDays: number,
  candidates: ReaderCandidate[],
): number[] {
  if (evaluatedDays === 0) return [];
  const firstDay = candidateDayRange(candidates).first;
  const returns = Array.from({ length: evaluatedDays }, () => 0);
  for (const entry of entries) {
    const offset = Math.floor((dayStart(entry.candidate.observedAt) - firstDay) / dayMs);
    if (offset >= 0 && offset < returns.length) returns[offset] = (returns[offset] ?? 0) + entry.resultR;
  }
  return returns.map(round);
}

function daysInCandidateRange(candidates: ReaderCandidate[]): number {
  if (candidates.length === 0) return 0;
  const range = candidateDayRange(candidates);
  return Math.floor((range.last - range.first) / dayMs) + 1;
}

function candidateDayRange(candidates: ReaderCandidate[]): { first: number; last: number } {
  let first = Number.POSITIVE_INFINITY;
  let last = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    const day = dayStart(candidate.observedAt);
    first = Math.min(first, day);
    last = Math.max(last, day);
  }
  return { first, last };
}

function dayStart(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function normalizedOptions(options: ReaderHypothesisMonteCarloOptions): Required<ReaderHypothesisMonteCarloOptions> {
  const samples = options.samples ?? 10_000;
  const seed = options.seed ?? 42;
  const percentileValue = options.percentile ?? 0.05;
  const ruinDrawdownR = options.ruinDrawdownR ?? -25;
  if (!Number.isInteger(samples) || samples <= 0 || !Number.isFinite(samples)) throw new Error("samples must be a positive finite integer");
  if (!Number.isInteger(seed) || !Number.isFinite(seed)) throw new Error("seed must be a finite integer");
  if (!Number.isFinite(percentileValue) || percentileValue < 0 || percentileValue > 0.5) throw new Error("percentile must be between 0 and 0.5");
  if (!Number.isFinite(ruinDrawdownR) || ruinDrawdownR >= 0) throw new Error("ruinDrawdownR must be a negative finite number");
  return {
    roundTripCostBps: options.roundTripCostBps ?? 0,
    samples,
    seed,
    percentile: percentileValue,
    ruinDrawdownR,
  };
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(percentileValue * (sorted.length - 1))));
  return sorted[index] ?? 0;
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
