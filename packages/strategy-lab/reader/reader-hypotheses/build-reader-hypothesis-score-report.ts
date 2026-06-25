import type { ReaderCandidate } from "../reader-candidates/types";
import { defaultReaderHypotheses } from "./default-reader-hypotheses";
import { evaluateReaderHypothesis, readerCandidateMatchesHypothesisFilters } from "./evaluate-reader-hypotheses";
import type {
  ReaderHypothesis,
  ReaderHypothesisBootstrapMetrics,
  ReaderHypothesisMetricRanks,
  ReaderHypothesisPathMetrics,
  ReaderHypothesisScoreOptions,
  ReaderHypothesisScoreReport,
  ReaderHypothesisScoreResult,
} from "./types";

type ScoredBase = Omit<ReaderHypothesisScoreResult, "paretoTier" | "aggregateRank" | "metricRanks">;

const dayMs = 24 * 60 * 60 * 1000;
const defaultBootstrapSamples = 500;
const defaultBootstrapSeed = 42;
const defaultBootstrapPercentile = 0.05;
const wilsonZ95 = 1.96;

export function buildReaderHypothesisScoreReport(input: {
  candidates: ReaderCandidate[];
  hypotheses?: ReaderHypothesis[];
  options?: ReaderHypothesisScoreOptions;
}): ReaderHypothesisScoreReport {
  const hypotheses = input.hypotheses ?? defaultReaderHypotheses;
  assertUniqueHypothesisIds(hypotheses);
  const options = normalizedOptions(input.options ?? {});
  const evaluatedDays = daysInCandidateRange(input.candidates);
  const evaluatedMonths = monthsInCandidateRange(input.candidates);
  const bootstrapSamples = options.bootstrapSamples;
  const bootstrapSeed = options.bootstrapSeed;
  const bootstrapPercentile = options.bootstrapPercentile;
  const base = hypotheses.map((hypothesis) => scoreHypothesis({
    candidates: input.candidates,
    hypothesis,
    evaluatedDays,
    evaluatedMonths,
    options,
    bootstrapSamples,
    bootstrapSeed,
    bootstrapPercentile,
  }));
  const withRanks = rankScores(base);

  return {
    summary: {
      candidates: input.candidates.length,
      hypotheses: hypotheses.length,
      roundTripCostBps: options.roundTripCostBps ?? 0,
      evaluatedDays,
      bootstrapSamples,
      bootstrapSeed,
      bootstrapPercentile,
    },
    ranked: withRanks,
  };
}

function scoreHypothesis(input: {
  candidates: ReaderCandidate[];
  hypothesis: ReaderHypothesis;
  evaluatedDays: number;
  evaluatedMonths: number;
  options: ReaderHypothesisScoreOptions;
  bootstrapSamples: number;
  bootstrapSeed: number;
  bootstrapPercentile: number;
}): ScoredBase {
  const result = evaluateReaderHypothesis({
    candidates: input.candidates,
    hypothesis: input.hypothesis,
    options: input.options,
  });
  const opportunityDays = uniqueDays(input.candidates.filter((candidate) => readerCandidateMatchesHypothesisFilters(candidate, input.hypothesis))).size;
  const dailyReturns = dailyReturnsFor(result.entries, input.evaluatedDays, input.candidates);
  return {
    hypothesis: input.hypothesis,
    summary: result.summary,
    path: pathMetrics({
      entries: result.entries,
      dailyReturns,
      evaluatedDays: input.evaluatedDays,
      evaluatedMonths: input.evaluatedMonths,
      opportunityDays,
      tradePathMaxDrawdownR: result.summary.maxDrawdownR,
    }),
    bootstrap: bootstrapDailyPath({
      dailyReturns,
      samples: input.bootstrapSamples,
      seed: input.bootstrapSeed,
      percentile: input.bootstrapPercentile,
    }),
  };
}

function rankScores(scores: ScoredBase[]): ReaderHypothesisScoreResult[] {
  const tiered = paretoTiers(scores);
  const rankMaps = {
    productivity: rankBy(scores, (score) => score.path.rPerEvaluatedDay),
    activity: rankBy(scores, (score) => sampleConfidence(score)),
    winConfidence: rankBy(scores, (score) => score.path.winRateLowerBound),
    risk: rankBy(scores, (score) => riskQuality(score)),
    stability: rankBy(scores, (score) => stabilityQuality(score)),
    bootstrap: rankBy(scores, (score) => bootstrapQuality(score)),
  };

  return scores.map((score) => {
    const metricRanks: ReaderHypothesisMetricRanks = {
      productivity: rankMaps.productivity.get(score.hypothesis.id) ?? scores.length,
      activity: rankMaps.activity.get(score.hypothesis.id) ?? scores.length,
      winConfidence: rankMaps.winConfidence.get(score.hypothesis.id) ?? scores.length,
      risk: rankMaps.risk.get(score.hypothesis.id) ?? scores.length,
      stability: rankMaps.stability.get(score.hypothesis.id) ?? scores.length,
      bootstrap: rankMaps.bootstrap.get(score.hypothesis.id) ?? scores.length,
    };
    return {
      ...score,
      paretoTier: tiered.get(score.hypothesis.id) ?? scores.length,
      aggregateRank: median(Object.values(metricRanks)),
      metricRanks,
    };
  }).sort((left, right) =>
    left.paretoTier - right.paretoTier
    || left.aggregateRank - right.aggregateRank
    || right.path.rPerEvaluatedDay - left.path.rPerEvaluatedDay
    || right.path.entries - left.path.entries
  );
}

function paretoTiers(scores: ScoredBase[]): Map<string, number> {
  const remaining = [...scores];
  const tiers = new Map<string, number>();
  let tier = 1;
  while (remaining.length > 0) {
    const front = remaining.filter((score) => !remaining.some((other) => dominates(other, score)));
    for (const score of front) tiers.set(score.hypothesis.id, tier);
    for (const score of front) remaining.splice(remaining.indexOf(score), 1);
    tier += 1;
  }
  return tiers;
}

function dominates(left: ScoredBase, right: ScoredBase): boolean {
  const leftMetrics = dominanceMetrics(left);
  const rightMetrics = dominanceMetrics(right);
  const noWorse = leftMetrics.every((metric, index) => metric >= rightMetrics[index]);
  const better = leftMetrics.some((metric, index) => metric > rightMetrics[index]);
  return noWorse && better;
}

function dominanceMetrics(score: ScoredBase): number[] {
  return [
    score.path.rPerEvaluatedDay,
    score.path.winRateLowerBound,
    riskQuality(score),
    stabilityQuality(score),
    sampleConfidence(score),
    score.bootstrap.positiveReturnProbability,
  ];
}

function pathMetrics(input: {
  entries: Array<{ candidate: ReaderCandidate; resultR: number }>;
  dailyReturns: number[];
  evaluatedDays: number;
  evaluatedMonths: number;
  opportunityDays: number;
  tradePathMaxDrawdownR: number;
}): ReaderHypothesisPathMetrics {
  const values = input.entries.map((entry) => entry.resultR);
  const totalR = sum(values);
  const worked = values.filter((value) => value > 0).length;
  const entryDays = uniqueDays(input.entries.map((entry) => entry.candidate)).size;
  const months = monthReturns(input.entries);
  const positiveMonths = months.filter((value) => value > 0).length;
  const negativeMonths = months.filter((value) => value < 0).length;
  const flatMonths = Math.max(0, input.evaluatedMonths - positiveMonths - negativeMonths);
  const drawdown = drawdownMetrics(input.dailyReturns);

  return {
    evaluatedDays: input.evaluatedDays,
    opportunityDays: input.opportunityDays,
    entryDays,
    entries: input.entries.length,
    tradesPerEvaluatedDay: ratio(input.entries.length, input.evaluatedDays),
    tradesPerEntryDay: ratio(input.entries.length, entryDays),
    totalR: round(totalR),
    rPerEvaluatedDay: ratio(totalR, input.evaluatedDays),
    rPerOpportunityDay: ratio(totalR, input.opportunityDays),
    rPerTrade: ratio(totalR, input.entries.length),
    winRate: ratio(worked, input.entries.length),
    winRateLowerBound: wilsonLowerBound(worked, input.entries.length),
    maxDrawdownR: input.tradePathMaxDrawdownR,
    maxDrawdownDurationDays: drawdown.maxDrawdownDurationDays,
    ulcerIndexR: drawdown.ulcerIndexR,
    painIndexR: drawdown.painIndexR,
    positiveMonths,
    negativeMonths,
    flatMonths,
    evaluatedMonths: input.evaluatedMonths,
    profitableMonthRate: ratio(positiveMonths, input.evaluatedMonths),
    worstMonthR: months.length === 0 ? null : round(Math.min(...months)),
  };
}

function bootstrapDailyPath(input: {
  dailyReturns: number[];
  samples: number;
  seed: number;
  percentile: number;
}): ReaderHypothesisBootstrapMetrics {
  if (input.dailyReturns.length === 0 || input.samples <= 0) {
    return {
      samples: 0,
      percentile: input.percentile,
      totalRLowerBound: 0,
      rPerDayLowerBound: 0,
      maxDrawdownRPessimistic: 0,
      positiveReturnProbability: 0,
    };
  }
  const totals: number[] = [];
  const rPerDay: number[] = [];
  const maxDrawdowns: number[] = [];
  let positive = 0;
  const random = seededRandom(input.seed);
  for (let sample = 0; sample < input.samples; sample += 1) {
    let total = 0;
    let equity = 0;
    let peak = 0;
    let maxDrawdown = 0;
    for (let index = 0; index < input.dailyReturns.length; index += 1) {
      const value = input.dailyReturns[Math.floor(random() * input.dailyReturns.length)] ?? 0;
      total += value;
      equity += value;
      peak = Math.max(peak, equity);
      maxDrawdown = Math.min(maxDrawdown, equity - peak);
    }
    totals.push(total);
    rPerDay.push(total / input.dailyReturns.length);
    maxDrawdowns.push(maxDrawdown);
    if (total > 0) positive += 1;
  }

  return {
    samples: input.samples,
    percentile: input.percentile,
    totalRLowerBound: round(percentile(totals, input.percentile)),
    rPerDayLowerBound: round(percentile(rPerDay, input.percentile)),
    maxDrawdownRPessimistic: round(percentile(maxDrawdowns, input.percentile)),
    positiveReturnProbability: round(positive / input.samples),
  };
}

function drawdownMetrics(returns: number[]): {
  maxDrawdownR: number;
  maxDrawdownDurationDays: number;
  ulcerIndexR: number;
  painIndexR: number;
} {
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let currentDuration = 0;
  let maxDuration = 0;
  const drawdowns: number[] = [];
  for (const value of returns) {
    equity += value;
    if (equity >= peak) {
      peak = equity;
      currentDuration = 0;
    } else {
      currentDuration += 1;
      maxDuration = Math.max(maxDuration, currentDuration);
    }
    const drawdown = equity - peak;
    maxDrawdown = Math.min(maxDrawdown, drawdown);
    drawdowns.push(drawdown);
  }
  const pain = drawdowns.length === 0 ? 0 : sum(drawdowns.map((value) => Math.abs(value))) / drawdowns.length;
  const ulcer = drawdowns.length === 0 ? 0 : Math.sqrt(sum(drawdowns.map((value) => value * value)) / drawdowns.length);
  return {
    maxDrawdownR: round(maxDrawdown),
    maxDrawdownDurationDays: maxDuration,
    ulcerIndexR: round(ulcer),
    painIndexR: round(pain),
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

function monthReturns(entries: Array<{ candidate: ReaderCandidate; resultR: number }>): number[] {
  const byMonth = new Map<string, number>();
  for (const entry of entries) {
    const key = new Date(entry.candidate.observedAt).toISOString().slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + entry.resultR);
  }
  return [...byMonth.values()].map(round);
}

function rankBy(scores: ScoredBase[], valueFor: (score: ScoredBase) => number): Map<string, number> {
  return new Map([...scores]
    .sort((left, right) => valueFor(right) - valueFor(left) || left.hypothesis.id.localeCompare(right.hypothesis.id))
    .map((score, index) => [score.hypothesis.id, index + 1]));
}

function sampleConfidence(score: ScoredBase): number {
  return Math.log1p(score.path.entries) * Math.sqrt(Math.max(0, score.path.entryDays));
}

function riskQuality(score: ScoredBase): number {
  return score.path.rPerEvaluatedDay / (1 + Math.abs(score.path.maxDrawdownR) + score.path.ulcerIndexR);
}

function stabilityQuality(score: ScoredBase): number {
  return score.path.profitableMonthRate + ratio(score.path.positiveMonths, 12) - Math.abs(score.path.worstMonthR ?? 0) / 100;
}

function bootstrapQuality(score: ScoredBase): number {
  return score.bootstrap.rPerDayLowerBound + score.bootstrap.positiveReturnProbability;
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

function uniqueDays(candidates: ReaderCandidate[]): Set<number> {
  return new Set(candidates.map((candidate) => dayStart(candidate.observedAt)));
}

function monthsInCandidateRange(candidates: ReaderCandidate[]): number {
  if (candidates.length === 0) return 0;
  const range = candidateDayRange(candidates);
  const first = new Date(range.first);
  const last = new Date(range.last);
  return (last.getUTCFullYear() - first.getUTCFullYear()) * 12 + (last.getUTCMonth() - first.getUTCMonth()) + 1;
}

function normalizedOptions(options: ReaderHypothesisScoreOptions): Required<ReaderHypothesisScoreOptions> {
  const bootstrapSamples = options.bootstrapSamples ?? defaultBootstrapSamples;
  const bootstrapSeed = options.bootstrapSeed ?? defaultBootstrapSeed;
  const bootstrapPercentile = options.bootstrapPercentile ?? defaultBootstrapPercentile;
  if (!Number.isInteger(bootstrapSamples) || bootstrapSamples <= 0 || !Number.isFinite(bootstrapSamples)) {
    throw new Error("bootstrapSamples must be a positive finite integer");
  }
  if (!Number.isInteger(bootstrapSeed) || !Number.isFinite(bootstrapSeed)) {
    throw new Error("bootstrapSeed must be a finite integer");
  }
  if (!Number.isFinite(bootstrapPercentile) || bootstrapPercentile < 0 || bootstrapPercentile > 1) {
    throw new Error("bootstrapPercentile must be between 0 and 1");
  }
  return {
    roundTripCostBps: options.roundTripCostBps ?? 0,
    bootstrapSamples,
    bootstrapSeed,
    bootstrapPercentile,
  };
}

function assertUniqueHypothesisIds(hypotheses: ReaderHypothesis[]): void {
  const seen = new Set<string>();
  for (const hypothesis of hypotheses) {
    if (seen.has(hypothesis.id)) throw new Error(`Duplicate reader hypothesis id: ${hypothesis.id}`);
    seen.add(hypothesis.id);
  }
}

function wilsonLowerBound(successes: number, total: number): number {
  if (total <= 0) return 0;
  const p = successes / total;
  const z2 = wilsonZ95 * wilsonZ95;
  const denominator = 1 + z2 / total;
  const center = p + z2 / (2 * total);
  const margin = wilsonZ95 * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total);
  return round((center - margin) / denominator);
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

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function finite(value: number | null | undefined): number | null {
  return value !== null && value !== undefined && Number.isFinite(value) ? value : null;
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : round(numerator / denominator);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
