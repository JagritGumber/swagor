import type { ReaderCandidate } from "../reader-candidates/types";
import { defaultReaderHypotheses } from "./default-reader-hypotheses";
import { evaluateReaderHypothesis } from "./evaluate-reader-hypotheses";
import type {
  ReaderHypothesis,
  ReaderHypothesisEvaluationOptions,
  ReaderHypothesisStabilityGroup,
  ReaderHypothesisStabilityReport,
  ReaderHypothesisStabilityResult,
} from "./types";

export function buildReaderHypothesisStabilityReport(input: {
  candidates: ReaderCandidate[];
  hypotheses?: ReaderHypothesis[];
  options?: ReaderHypothesisEvaluationOptions;
  splitAt?: number;
}): ReaderHypothesisStabilityReport {
  const hypotheses = input.hypotheses ?? defaultReaderHypotheses;
  const options = input.options ?? {};
  const ranked = hypotheses
    .map((hypothesis) => stabilityFor({
      candidates: input.candidates,
      hypothesis,
      options,
      splitAt: input.splitAt,
    }))
    .sort((left, right) =>
      right.summary.totalR - left.summary.totalR
      || right.profitableGroupRate - left.profitableGroupRate
      || right.summary.entries - left.summary.entries
    );

  return {
    summary: {
      candidates: input.candidates.length,
      hypotheses: hypotheses.length,
      roundTripCostBps: options.roundTripCostBps ?? 0,
      splitAt: input.splitAt ?? null,
    },
    ranked,
  };
}

function stabilityFor(input: {
  candidates: ReaderCandidate[];
  hypothesis: ReaderHypothesis;
  options: ReaderHypothesisEvaluationOptions;
  splitAt?: number;
}): ReaderHypothesisStabilityResult {
  const summary = evaluateReaderHypothesis(input).summary;
  const groups = monthGroups(input.candidates, input.hypothesis, input.options);
  const positiveGroups = groups.filter((group) => group.summary.totalR > 0).length;
  const negativeGroups = groups.filter((group) => group.summary.totalR < 0).length;
  const flatGroups = groups.filter((group) => group.summary.totalR === 0).length;
  const splitAt = input.splitAt;

  return {
    hypothesis: input.hypothesis,
    summary,
    groups,
    positiveGroups,
    negativeGroups,
    flatGroups,
    profitableGroupRate: groups.length === 0 ? 0 : round(positiveGroups / groups.length),
    bestGroup: groups[0] ?? null,
    worstGroup: groups.length === 0 ? null : [...groups].sort((left, right) => left.summary.totalR - right.summary.totalR)[0] ?? null,
    train: splitAt === undefined ? null : evaluateReaderHypothesis({
      candidates: input.candidates.filter((candidate) => candidate.observedAt < splitAt),
      hypothesis: input.hypothesis,
      options: input.options,
    }).summary,
    test: splitAt === undefined ? null : evaluateReaderHypothesis({
      candidates: input.candidates.filter((candidate) => candidate.observedAt >= splitAt),
      hypothesis: input.hypothesis,
      options: input.options,
    }).summary,
  };
}

function monthGroups(
  candidates: ReaderCandidate[],
  hypothesis: ReaderHypothesis,
  options: ReaderHypothesisEvaluationOptions,
): ReaderHypothesisStabilityGroup[] {
  const groups = new Map<string, ReaderCandidate[]>();
  for (const candidate of candidates) {
    const key = monthFor(candidate.observedAt);
    const group = groups.get(key) ?? [];
    group.push(candidate);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .map(([key, groupCandidates]) => ({
      key,
      summary: evaluateReaderHypothesis({
        candidates: groupCandidates,
        hypothesis,
        options,
      }).summary,
    }))
    .filter((group) => group.summary.entries > 0)
    .sort((left, right) => right.summary.totalR - left.summary.totalR || left.key.localeCompare(right.key));
}

function monthFor(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return "unknown";
  return new Date(timestamp).toISOString().slice(0, 7);
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}



