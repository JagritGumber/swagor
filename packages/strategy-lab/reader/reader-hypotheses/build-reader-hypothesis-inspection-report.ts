import type { ReaderCandidate } from "../reader-candidates/types";
import { evaluateReaderHypothesis } from "./evaluate-reader-hypotheses";
import type { ReaderHypothesis, ReaderHypothesisEvaluationOptions, ReaderHypothesisSummary } from "./types";

export type ReaderHypothesisInspectionEntry = {
  ref: string;
  observedAt: string;
  family: string;
  side: string | null;
  resultR: number;
  costR: number;
  entryPrice: number | null;
  target: number | null;
  invalidation: number | null;
  targetR: number | null;
  invalidationBps: number | null;
  firstReactionR: number | null;
  maxFavorableR: number | null;
  maxAdverseR: number | null;
  regime: string | null;
  auctionLocation: string;
  vpAuction: string | null;
  vpPoc: string | null;
  vpValue: string | null;
  orderflowPressure: string;
  orderflowEvents: string[];
  tradeCount: number;
  largestTradeSide: string | null;
  builderResponse: string;
  builderReasons: string[];
};

export type ReaderHypothesisInspectionGroup = {
  key: string;
  summary: ReaderHypothesisSummary;
};

export type ReaderHypothesisInspectionResult = {
  hypothesis: ReaderHypothesis;
  summary: ReaderHypothesisSummary;
  byMonth: ReaderHypothesisInspectionGroup[];
  byFamily: ReaderHypothesisInspectionGroup[];
  byRegime: ReaderHypothesisInspectionGroup[];
  byEvent: ReaderHypothesisInspectionGroup[];
  bestTrades: ReaderHypothesisInspectionEntry[];
  worstTrades: ReaderHypothesisInspectionEntry[];
  longestLosingStreak: ReaderHypothesisInspectionEntry[];
  representativeTrades: ReaderHypothesisInspectionEntry[];
};

export type ReaderHypothesisInspectionReport = {
  summary: {
    candidates: number;
    hypotheses: number;
    roundTripCostBps: number;
    sampleSize: number;
  };
  results: ReaderHypothesisInspectionResult[];
};

export function buildReaderHypothesisInspectionReport(input: {
  candidates: ReaderCandidate[];
  hypotheses: ReaderHypothesis[];
  options?: ReaderHypothesisEvaluationOptions;
  sampleSize?: number;
}): ReaderHypothesisInspectionReport {
  const sampleSize = input.sampleSize ?? 10;
  return {
    summary: {
      candidates: input.candidates.length,
      hypotheses: input.hypotheses.length,
      roundTripCostBps: input.options?.roundTripCostBps ?? 0,
      sampleSize,
    },
    results: input.hypotheses.map((hypothesis) => inspectHypothesis({
      candidates: input.candidates,
      hypothesis,
      options: input.options ?? {},
      sampleSize,
    })),
  };
}

function inspectHypothesis(input: {
  candidates: ReaderCandidate[];
  hypothesis: ReaderHypothesis;
  options: ReaderHypothesisEvaluationOptions;
  sampleSize: number;
}): ReaderHypothesisInspectionResult {
  const result = evaluateReaderHypothesis(input);
  const chronological = [...result.entries].sort((left, right) =>
    left.candidate.observedAt - right.candidate.observedAt || left.candidate.index - right.candidate.index
  );
  const best = [...result.entries].sort((left, right) => right.resultR - left.resultR).slice(0, input.sampleSize);
  const worst = [...result.entries].sort((left, right) => left.resultR - right.resultR).slice(0, input.sampleSize);

  return {
    hypothesis: input.hypothesis,
    summary: result.summary,
    byMonth: grouped(chronological, (entry) => new Date(entry.candidate.observedAt).toISOString().slice(0, 7)),
    byFamily: grouped(chronological, (entry) => entry.candidate.family),
    byRegime: grouped(chronological, (entry) => entry.candidate.reader.regime ?? "unknown"),
    byEvent: groupedEvents(chronological),
    bestTrades: best.map(entryFor),
    worstTrades: worst.map(entryFor),
    longestLosingStreak: longestLosingStreak(chronological).map(entryFor),
    representativeTrades: representativeTrades(chronological, input.sampleSize).map(entryFor),
  };
}

function grouped(
  entries: Array<{ candidate: ReaderCandidate; resultR: number; costR: number }>,
  keyFor: (entry: { candidate: ReaderCandidate; resultR: number; costR: number }) => string,
): ReaderHypothesisInspectionGroup[] {
  const groups = new Map<string, Array<{ candidate: ReaderCandidate; resultR: number; costR: number }>>();
  for (const entry of entries) {
    const key = keyFor(entry);
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .map(([key, groupEntries]) => ({ key, summary: summarize(groupEntries) }))
    .sort((left, right) => right.summary.totalR - left.summary.totalR || right.summary.entries - left.summary.entries);
}

function groupedEvents(entries: Array<{ candidate: ReaderCandidate; resultR: number; costR: number }>): ReaderHypothesisInspectionGroup[] {
  const groups = new Map<string, Array<{ candidate: ReaderCandidate; resultR: number; costR: number }>>();
  for (const entry of entries) {
    const events = entry.candidate.orderflow.events.length === 0 ? ["none"] : entry.candidate.orderflow.events;
    for (const event of events) {
      const group = groups.get(event) ?? [];
      group.push(entry);
      groups.set(event, group);
    }
  }
  return [...groups.entries()]
    .map(([key, groupEntries]) => ({ key, summary: summarize(groupEntries) }))
    .sort((left, right) => right.summary.totalR - left.summary.totalR || right.summary.entries - left.summary.entries);
}

function longestLosingStreak(entries: Array<{ candidate: ReaderCandidate; resultR: number; costR: number }>): Array<{ candidate: ReaderCandidate; resultR: number; costR: number }> {
  let current: Array<{ candidate: ReaderCandidate; resultR: number; costR: number }> = [];
  let longest: Array<{ candidate: ReaderCandidate; resultR: number; costR: number }> = [];
  for (const entry of entries) {
    if (entry.resultR < 0) {
      current.push(entry);
      if (current.length > longest.length) longest = current;
    } else {
      current = [];
    }
  }
  return longest;
}

function representativeTrades(
  entries: Array<{ candidate: ReaderCandidate; resultR: number; costR: number }>,
  sampleSize: number,
): Array<{ candidate: ReaderCandidate; resultR: number; costR: number }> {
  if (entries.length <= sampleSize) return entries;
  const selected: Array<{ candidate: ReaderCandidate; resultR: number; costR: number }> = [];
  const step = (entries.length - 1) / (sampleSize - 1);
  for (let index = 0; index < sampleSize; index += 1) {
    selected.push(entries[Math.round(index * step)] ?? entries[entries.length - 1]!);
  }
  return selected;
}

function entryFor(entry: { candidate: ReaderCandidate; resultR: number; costR: number }): ReaderHypothesisInspectionEntry {
  const candidate = entry.candidate;
  return {
    ref: `${candidate.asset}#${candidate.index}@${new Date(candidate.observedAt).toISOString()}`,
    observedAt: new Date(candidate.observedAt).toISOString(),
    family: candidate.family,
    side: candidate.side,
    resultR: round(entry.resultR),
    costR: round(entry.costR),
    entryPrice: candidate.entryPrice,
    target: candidate.target,
    invalidation: candidate.invalidation,
    targetR: candidate.outcome.targetR,
    invalidationBps: candidate.outcome.invalidationBps,
    firstReactionR: candidate.outcome.firstReactionR,
    maxFavorableR: candidate.outcome.maxFavorableR,
    maxAdverseR: candidate.outcome.maxAdverseR,
    regime: candidate.reader.regime,
    auctionLocation: candidate.reader.auctionLocation,
    vpAuction: candidate.reader.vpAuction,
    vpPoc: candidate.reader.vpPoc,
    vpValue: candidate.reader.vpValue,
    orderflowPressure: candidate.orderflow.pressure,
    orderflowEvents: candidate.orderflow.events,
    tradeCount: candidate.orderflow.tradeCount,
    largestTradeSide: candidate.orderflow.largestTradeSide,
    builderResponse: candidate.builder.response,
    builderReasons: candidate.builder.reasons,
  };
}

function summarize(entries: Array<{ candidate: ReaderCandidate; resultR: number }>): ReaderHypothesisSummary {
  const values = entries.map((entry) => entry.resultR);
  const grossWinR = sum(values.filter((value) => value > 0));
  const grossLossR = sum(values.filter((value) => value < 0));
  return {
    candidates: entries.length,
    entries: entries.length,
    skipped: 0,
    worked: values.filter((value) => value > 0).length,
    invalidated: values.filter((value) => value < 0).length,
    winRate: ratio(values.filter((value) => value > 0).length, entries.length),
    totalR: round(sum(values)),
    averageR: ratio(sum(values), entries.length),
    grossWinR: round(grossWinR),
    grossLossR: round(grossLossR),
    profitFactor: grossLossR < 0 ? round(grossWinR / Math.abs(grossLossR)) : null,
    maxDrawdownR: equityRisk(entries),
    bestR: values.length === 0 ? null : round(Math.max(...values)),
    worstR: values.length === 0 ? null : round(Math.min(...values)),
  };
}

function equityRisk(entries: Array<{ candidate: ReaderCandidate; resultR: number }>): number {
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const entry of entries) {
    equity += entry.resultR;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.min(maxDrawdown, equity - peak);
  }
  return round(maxDrawdown);
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
