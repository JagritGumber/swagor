import type { ReaderCandidate } from "../reader-candidates/types";
import { defaultReaderHypotheses } from "./default-reader-hypotheses";
import { evaluateReaderHypothesis, evaluateReaderHypotheses } from "./evaluate-reader-hypotheses";
import type {
  ReaderHypothesis,
  ReaderHypothesisEvaluationOptions,
  ReaderHypothesisGroupResult,
  ReaderHypothesisReport,
  ReaderHypothesisReportResult,
} from "./types";

export function buildReaderHypothesisReport(input: {
  candidates: ReaderCandidate[];
  hypotheses?: ReaderHypothesis[];
  options?: ReaderHypothesisEvaluationOptions;
}): ReaderHypothesisReport {
  const hypotheses = input.hypotheses ?? defaultReaderHypotheses;
  const options = input.options ?? {};
  const ranked = evaluateReaderHypotheses({
    candidates: input.candidates,
    hypotheses,
    options,
  }).map((result) => ({
    ...result,
    byMonth: grouped(input.candidates, (candidate) => monthFor(candidate.observedAt), result.hypothesis, options),
    byFamily: grouped(input.candidates, (candidate) => candidate.family, result.hypothesis, options),
    byRegime: grouped(input.candidates, (candidate) => candidate.reader.regime ?? "unknown", result.hypothesis, options),
  }));

  return {
    summary: {
      candidates: input.candidates.length,
      hypotheses: hypotheses.length,
      roundTripCostBps: options.roundTripCostBps ?? 0,
    },
    ranked,
    bestByKind: bestByKind(ranked),
  };
}

function grouped(
  candidates: ReaderCandidate[],
  keyFor: (candidate: ReaderCandidate) => string,
  hypothesis: ReaderHypothesis,
  options: ReaderHypothesisEvaluationOptions,
): ReaderHypothesisGroupResult[] {
  const groups = new Map<string, ReaderCandidate[]>();
  for (const candidate of candidates) {
    const key = keyFor(candidate);
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
    .sort((left, right) => right.summary.totalR - left.summary.totalR || right.summary.entries - left.summary.entries);
}

function bestByKind(ranked: ReaderHypothesisReportResult[]): ReaderHypothesisReportResult[] {
  const byKind = new Map<ReaderHypothesis["kind"], ReaderHypothesisReportResult>();
  for (const result of ranked) {
    const current = byKind.get(result.hypothesis.kind);
    if (!current || result.summary.totalR > current.summary.totalR) {
      byKind.set(result.hypothesis.kind, result);
    }
  }
  return [...byKind.values()].sort((left, right) => right.summary.totalR - left.summary.totalR);
}

function monthFor(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return "unknown";
  return new Date(timestamp).toISOString().slice(0, 7);
}



