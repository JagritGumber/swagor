import type { ReaderCandidate, ReaderCandidateFamily } from "../reader-candidates/types";
import type { Side } from "../../types";
import { evaluateReaderHypothesis, evaluateReaderHypotheses } from "./evaluate-reader-hypotheses";
import type {
  ReaderHypothesis,
  ReaderHypothesisConfirmationType,
  ReaderHypothesisEvaluationOptions,
  ReaderHypothesisGroupResult,
  ReaderHypothesisReportResult,
  ReaderHypothesisSweepBand,
  ReaderHypothesisSweepInput,
  ReaderHypothesisSweepReport,
} from "./types";

const defaultInvalidationBands: ReaderHypothesisSweepBand[] = [
  { min: 2, max: 5 },
  { min: 5, max: 10 },
  { min: 10, max: 20 },
  { min: 2, max: 10 },
  { min: 2, max: 20 },
];

const defaultTradeCountBands: ReaderHypothesisSweepBand[] = [
  { min: 0, max: 250 },
  { min: 250, max: 500 },
  { min: 500, max: 1000 },
  { min: 0, max: 1000 },
];

export function buildReaderHypothesisSweep(input: {
  candidates: ReaderCandidate[];
  sweep?: ReaderHypothesisSweepInput;
  options?: ReaderHypothesisEvaluationOptions;
}): ReaderHypothesisSweepReport {
  const sweep = input.sweep ?? {};
  const minEntries = sweep.minEntries ?? 20;
  const maxEntries = sweep.maxEntries ?? Number.POSITIVE_INFINITY;
  const hypotheses = sweepHypotheses(input.candidates, sweep);
  const rankedBase = evaluateReaderHypotheses({
    candidates: input.candidates,
    hypotheses,
    options: input.options,
  })
    .filter((result) => result.summary.entries >= minEntries)
    .filter((result) => result.summary.entries <= maxEntries)
    .slice(0, sweep.top ?? 40);
  const ranked = rankedBase.map((result) => ({
    ...result,
    byMonth: grouped(input.candidates, (candidate) => monthFor(candidate.observedAt), result.hypothesis, input.options ?? {}),
    byFamily: grouped(input.candidates, (candidate) => candidate.family, result.hypothesis, input.options ?? {}),
    byRegime: grouped(input.candidates, (candidate) => candidate.reader.regime ?? "unknown", result.hypothesis, input.options ?? {}),
  }));

  return {
    summary: {
      candidates: input.candidates.length,
      generated: hypotheses.length,
      kept: ranked.length,
      roundTripCostBps: input.options?.roundTripCostBps ?? 0,
      minEntries,
      maxEntries: Number.isFinite(maxEntries) ? maxEntries : null,
    },
    ranked,
    bestByKind: bestByKind(ranked),
  };
}

function sweepHypotheses(candidates: ReaderCandidate[], sweep: ReaderHypothesisSweepInput): ReaderHypothesis[] {
  const families = valuesWithAny<ReaderCandidateFamily>(
    sweep.families,
    candidates.map((candidate) => candidate.family),
    sweep.includeAnyFamily ?? true,
  );
  const sides = valuesWithAny<Side>(
    sweep.sides,
    candidates.map((candidate) => candidate.side).filter((side): side is Side => side !== null),
    sweep.includeAnySide ?? true,
  );
  const regimes = valuesWithAny<string>(
    sweep.regimes,
    candidates.map((candidate) => candidate.reader.regime ?? "unknown"),
    sweep.includeAnyRegime ?? true,
  );
  const events = valuesWithAny<string>(
    sweep.events,
    topValues(candidates.flatMap((candidate) => candidate.orderflow.events), 16),
    sweep.includeAnyEvent ?? true,
  );
  const confirmationTypes = sweep.confirmationTypes ?? ["none", "first-reaction", "max-favorable"];
  const thresholds = sweep.thresholdsR ?? [0, 0.25, 0.5, 1, 1.5];
  const invalidationBands = sweep.invalidationBpsBands ?? defaultInvalidationBands;
  const tradeCountBands = sweep.tradeCountBands ?? defaultTradeCountBands;
  const hypotheses: ReaderHypothesis[] = [];

  for (const family of families) {
    for (const side of sides) {
      for (const regime of regimes) {
        for (const event of events) {
          for (const confirmationType of confirmationTypes) {
            for (const thresholdR of thresholds) {
              if (confirmationType === "none" && thresholdR !== 0) continue;
              for (const invalidationBand of invalidationBands) {
                for (const tradeBand of tradeCountBands) {
                  hypotheses.push(hypothesisFor({
                    family,
                    side,
                    regime,
                    event,
                    confirmationType,
                    thresholdR,
                    invalidationBand,
                    tradeBand,
                    maxAbsResultR: sweep.maxAbsResultR ?? 100,
                  }));
                }
              }
            }
          }
        }
      }
    }
  }
  return dedupeHypotheses(hypotheses);
}

function hypothesisFor(input: {
  family: ReaderCandidateFamily | "*";
  side: Side | "*";
  regime: string | "*";
  event: string | "*";
  confirmationType: ReaderHypothesisConfirmationType;
  thresholdR: number;
  invalidationBand: ReaderHypothesisSweepBand;
  tradeBand: ReaderHypothesisSweepBand;
  maxAbsResultR: number;
}): ReaderHypothesis {
  const id = [
    input.family === "*" ? "any-family" : input.family,
    input.side === "*" ? "any-side" : input.side,
    input.regime === "*" ? "any-regime" : input.regime,
    input.event === "*" ? "any-event" : input.event,
    input.confirmationType,
    `thr-${input.thresholdR}`,
    `inv-${bandKey(input.invalidationBand)}`,
    `trades-${bandKey(input.tradeBand)}`,
  ].join("__");
  return {
    id,
    label: id,
    description: "Generated reader hypothesis sweep variant.",
    kind: kindFor(input.family),
    filters: {
      family: input.family === "*" ? undefined : input.family,
      side: input.side === "*" ? undefined : input.side,
      regime: input.regime === "*" ? undefined : input.regime,
      event: input.event === "*" ? undefined : input.event,
      minInvalidationBps: input.invalidationBand.min,
      maxInvalidationBps: input.invalidationBand.max ?? undefined,
      minTradeCount: input.tradeBand.min,
      maxTradeCount: input.tradeBand.max ?? undefined,
      maxAbsResultR: input.maxAbsResultR,
    },
    confirmation: {
      type: input.confirmationType,
      thresholdR: input.thresholdR,
    },
  };
}

function kindFor(family: ReaderCandidateFamily | "*"): ReaderHypothesis["kind"] {
  if (family === "trend-continuation" || family === "initiative-continuation") return "trend-following";
  if (family === "absorption-reaction" || family === "value-high-reaction" || family === "value-low-reaction") return "adverse-reader";
  return "mixed-reader";
}

function valuesWithAny<T extends string>(
  configured: Array<T | "*"> | undefined,
  observed: T[],
  includeAny: boolean,
): Array<T | "*"> {
  if (configured && configured.length > 0) return configured;
  const values = unique(observed);
  return includeAny ? ["*", ...values] : values;
}

function bestByKind(ranked: ReaderHypothesisReportResult[]): ReaderHypothesisReportResult[] {
  const byKind = new Map<ReaderHypothesis["kind"], ReaderHypothesisReportResult>();
  for (const result of ranked) {
    const current = byKind.get(result.hypothesis.kind);
    if (!current || result.summary.totalR > current.summary.totalR) byKind.set(result.hypothesis.kind, result);
  }
  return [...byKind.values()].sort((left, right) => right.summary.totalR - left.summary.totalR);
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

function dedupeHypotheses(hypotheses: ReaderHypothesis[]): ReaderHypothesis[] {
  const byId = new Map<string, ReaderHypothesis>();
  for (const hypothesis of hypotheses) byId.set(hypothesis.id, hypothesis);
  return [...byId.values()];
}

function bandKey(band: ReaderHypothesisSweepBand): string {
  return band.max === null ? `${band.min}+` : `${band.min}-${band.max}`;
}

function unique<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort();
}

function topValues(values: string[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([value]) => value);
}

function monthFor(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return "unknown";
  return new Date(timestamp).toISOString().slice(0, 7);
}


