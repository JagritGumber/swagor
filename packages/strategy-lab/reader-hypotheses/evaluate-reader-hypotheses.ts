import type { ReaderCandidate } from "../reader-candidates/types";
import type {
  ReaderHypothesis,
  ReaderHypothesisEvaluationOptions,
  ReaderHypothesisResult,
  ReaderHypothesisSummary,
} from "./types";

export function evaluateReaderHypotheses(input: {
  candidates: ReaderCandidate[];
  hypotheses: ReaderHypothesis[];
  options?: ReaderHypothesisEvaluationOptions;
}): ReaderHypothesisResult[] {
  return input.hypotheses
    .map((hypothesis) => evaluateReaderHypothesis({
      candidates: input.candidates,
      hypothesis,
      options: input.options,
    }))
    .sort((left, right) => right.summary.totalR - left.summary.totalR || right.summary.entries - left.summary.entries);
}

export function evaluateReaderHypothesis(input: {
  candidates: ReaderCandidate[];
  hypothesis: ReaderHypothesis;
  options?: ReaderHypothesisEvaluationOptions;
}): ReaderHypothesisResult {
  const filtered = input.candidates.filter((candidate) => matchesFilters(candidate, input.hypothesis));
  const entries = filtered
    .filter((candidate) => matchesConfirmation(candidate, input.hypothesis))
    .map((candidate) => {
      const costR = costRFor(candidate, input.options?.roundTripCostBps ?? 0);
      return {
        candidate,
        resultR: round(delayedResultR(candidate, input.hypothesis) - costR),
        costR,
      };
    });

  return {
    hypothesis: input.hypothesis,
    summary: summarize({
      candidates: filtered.length,
      entries,
    }),
    entries,
  };
}

function matchesFilters(candidate: ReaderCandidate, hypothesis: ReaderHypothesis): boolean {
  const filters = hypothesis.filters;
  const resultR = finite(candidate.outcome.resultR);
  const targetR = finite(candidate.outcome.targetR);
  const invalidationBps = finite(candidate.outcome.invalidationBps);
  const tradeCount = finite(candidate.orderflow.tradeCount);
  if (candidate.outcome.verdict !== "worked" && candidate.outcome.verdict !== "invalidated") return false;
  if (resultR === null || targetR === null) return false;
  if (filters.family !== undefined && candidate.family !== filters.family) return false;
  if (filters.side !== undefined && candidate.side !== filters.side) return false;
  if (filters.regime !== undefined && candidate.reader.regime !== filters.regime) return false;
  if (filters.event !== undefined && !candidate.orderflow.events.includes(filters.event)) return false;
  if (filters.minInvalidationBps !== undefined && (invalidationBps === null || invalidationBps < filters.minInvalidationBps)) return false;
  if (filters.maxInvalidationBps !== undefined && (invalidationBps === null || invalidationBps >= filters.maxInvalidationBps)) return false;
  if (filters.minTradeCount !== undefined && (tradeCount === null || tradeCount < filters.minTradeCount)) return false;
  if (filters.maxTradeCount !== undefined && (tradeCount === null || tradeCount >= filters.maxTradeCount)) return false;
  if (filters.maxAbsResultR !== undefined && Math.abs(resultR) > filters.maxAbsResultR) return false;
  return true;
}

function matchesConfirmation(candidate: ReaderCandidate, hypothesis: ReaderHypothesis): boolean {
  const threshold = hypothesis.confirmation.thresholdR;
  const targetR = finite(candidate.outcome.targetR);
  if (targetR === null || targetR <= threshold) return false;
  if (hypothesis.confirmation.type === "none") return true;
  const value = confirmationValue(candidate, hypothesis.confirmation.type);
  return value !== null && value >= threshold;
}

function delayedResultR(candidate: ReaderCandidate, hypothesis: ReaderHypothesis): number {
  if (hypothesis.confirmation.type === "none") return finite(candidate.outcome.resultR) ?? 0;
  const threshold = hypothesis.confirmation.thresholdR;
  const riskR = 1 + threshold;
  if (candidate.outcome.verdict === "worked") return ((finite(candidate.outcome.targetR) ?? 0) - threshold) / riskR;
  return -1;
}

function confirmationValue(candidate: ReaderCandidate, type: ReaderHypothesis["confirmation"]["type"]): number | null {
  if (type === "first-reaction") return finite(candidate.outcome.firstReactionR);
  if (type === "max-favorable") return finite(candidate.outcome.maxFavorableR);
  return null;
}

function costRFor(candidate: ReaderCandidate, roundTripCostBps: number): number {
  if (roundTripCostBps <= 0) return 0;
  const invalidationBps = finite(candidate.outcome.invalidationBps);
  if (invalidationBps === null || invalidationBps <= 0) return 0;
  return round(roundTripCostBps / invalidationBps);
}

function summarize(input: {
  candidates: number;
  entries: Array<{ candidate: ReaderCandidate; resultR: number }>;
}): ReaderHypothesisSummary {
  const values = input.entries.map((entry) => entry.resultR);
  const worked = input.entries.filter((entry) => entry.resultR > 0).length;
  const invalidated = input.entries.filter((entry) => entry.resultR < 0).length;
  const grossWinR = sum(values.filter((value) => value > 0));
  const grossLossR = sum(values.filter((value) => value < 0));
  const equity = equityRisk(input.entries);
  return {
    candidates: input.candidates,
    entries: input.entries.length,
    skipped: input.candidates - input.entries.length,
    worked,
    invalidated,
    winRate: input.entries.length === 0 ? 0 : round(worked / input.entries.length),
    totalR: round(sum(values)),
    averageR: input.entries.length === 0 ? 0 : round(sum(values) / input.entries.length),
    grossWinR: round(grossWinR),
    grossLossR: round(grossLossR),
    profitFactor: grossLossR < 0 ? round(grossWinR / Math.abs(grossLossR)) : null,
    maxDrawdownR: equity.maxDrawdownR,
    bestR: values.length === 0 ? null : round(Math.max(...values)),
    worstR: values.length === 0 ? null : round(Math.min(...values)),
  };
}

function equityRisk(entries: Array<{ candidate: ReaderCandidate; resultR: number }>): {
  maxDrawdownR: number;
} {
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  const chronological = [...entries].sort((left, right) =>
    left.candidate.observedAt - right.candidate.observedAt || left.candidate.index - right.candidate.index
  );
  for (const entry of chronological) {
    equity += entry.resultR;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.min(maxDrawdown, equity - peak);
  }
  return {
    maxDrawdownR: round(maxDrawdown),
  };
}

function finite(value: number | null | undefined): number | null {
  return value !== null && value !== undefined && Number.isFinite(value) ? value : null;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
