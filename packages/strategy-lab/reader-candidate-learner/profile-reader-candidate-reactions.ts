import type { ReaderCandidate } from "../reader-candidates/types";

export type ReaderCandidateReactionFilter = {
  family?: string;
  side?: string;
  auctionLocation?: string;
  auctionLevelKind?: string;
  auctionMode?: string;
  auctionPhase?: string;
  vpAuction?: string;
  vpPoc?: string;
  vpValue?: string;
  orderflowPressure?: string;
  narrativeIntent?: string;
  narrativeDirection?: string;
  localRangeLocation?: string;
  builderResponse?: string;
  riskTargetOnly?: boolean;
  firstReaction?: string;
};

export type ReaderCandidateReactionSummary = {
  candidates: number;
  judgeable: number;
  worked: number;
  invalidated: number;
  workedRate: number;
  totalR: number;
  maxDrawdownR: number;
  minEquityR: number;
  averageR: number | null;
  medianR: number | null;
  averageFirstReactionR: number | null;
  medianFirstReactionR: number | null;
  averageTargetR: number | null;
  medianTargetR: number | null;
  averageInvalidationBps: number | null;
  medianInvalidationBps: number | null;
};

export type ReaderCandidateReactionBucket = {
  key: string;
  minFirstReactionR: number | null;
  maxFirstReactionR: number | null;
  summary: ReaderCandidateReactionSummary;
  refs: string[];
};

export type ReaderCandidateReactionProfile = {
  filter: ReaderCandidateReactionFilter;
  buckets: number;
  summary: ReaderCandidateReactionSummary;
  reactionBuckets: ReaderCandidateReactionBucket[];
};

export function profileReaderCandidateReactions(input: {
  candidates: ReaderCandidate[];
  filter?: ReaderCandidateReactionFilter;
  buckets: number;
}): ReaderCandidateReactionProfile {
  if (!Number.isInteger(input.buckets) || input.buckets <= 0) {
    throw new Error("candidate reaction profile buckets must be a positive integer");
  }
  const filter = input.filter ?? {};
  const candidates = input.candidates.filter((candidate) => matchesFilter(candidate, filter));
  const finite = candidates
    .filter((candidate) => finiteNumber(candidate.outcome.firstReactionR))
    .sort((left, right) => (left.outcome.firstReactionR ?? 0) - (right.outcome.firstReactionR ?? 0));

  return {
    filter,
    buckets: input.buckets,
    summary: summarize(candidates),
    reactionBuckets: bucketed(finite, input.buckets),
  };
}

function bucketed(candidates: ReaderCandidate[], bucketCount: number): ReaderCandidateReactionBucket[] {
  if (candidates.length === 0) return [];
  const buckets: ReaderCandidateReactionBucket[] = [];
  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const start = Math.floor((bucket * candidates.length) / bucketCount);
    const end = Math.floor(((bucket + 1) * candidates.length) / bucketCount);
    const items = candidates.slice(start, end);
    if (items.length === 0) continue;
    buckets.push({
      key: `q${bucket + 1}`,
      minFirstReactionR: round(items[0]?.outcome.firstReactionR ?? null),
      maxFirstReactionR: round(items[items.length - 1]?.outcome.firstReactionR ?? null),
      summary: summarize(items),
      refs: items.slice(0, 12).map(refFor),
    });
  }
  return buckets;
}

function matchesFilter(candidate: ReaderCandidate, filter: ReaderCandidateReactionFilter): boolean {
  if (filter.family !== undefined && candidate.family !== filter.family) return false;
  if (filter.side !== undefined && candidate.side !== filter.side) return false;
  if (filter.auctionLocation !== undefined && candidate.reader.auctionLocation !== filter.auctionLocation) return false;
  if (filter.auctionLevelKind !== undefined && candidate.reader.auctionLevelKind !== filter.auctionLevelKind) return false;
  if (filter.auctionMode !== undefined && candidate.reader.auctionMode !== filter.auctionMode) return false;
  if (filter.auctionPhase !== undefined && candidate.reader.auctionPhase !== filter.auctionPhase) return false;
  if (filter.vpAuction !== undefined && candidate.reader.vpAuction !== filter.vpAuction) return false;
  if (filter.vpPoc !== undefined && candidate.reader.vpPoc !== filter.vpPoc) return false;
  if (filter.vpValue !== undefined && candidate.reader.vpValue !== filter.vpValue) return false;
  if (filter.orderflowPressure !== undefined && candidate.orderflow.pressure !== filter.orderflowPressure) return false;
  if (filter.narrativeIntent !== undefined && candidate.reader.narrativeIntent !== filter.narrativeIntent) return false;
  if (filter.narrativeDirection !== undefined && candidate.reader.narrativeDirection !== filter.narrativeDirection) return false;
  if (filter.localRangeLocation !== undefined && candidate.reader.localRangeLocation !== filter.localRangeLocation) return false;
  if (filter.builderResponse !== undefined && candidate.builder.response !== filter.builderResponse) return false;
  if (filter.firstReaction !== undefined && candidate.outcome.firstReaction !== filter.firstReaction) return false;
  if (filter.riskTargetOnly && (candidate.outcome.targetR === null || candidate.outcome.targetR < 1)) return false;
  return true;
}

function summarize(candidates: ReaderCandidate[]): ReaderCandidateReactionSummary {
  const judgeable = candidates.filter((candidate) =>
    candidate.outcome.verdict === "worked" || candidate.outcome.verdict === "invalidated"
  );
  const worked = judgeable.filter((candidate) => candidate.outcome.verdict === "worked").length;
  const invalidated = judgeable.filter((candidate) => candidate.outcome.verdict === "invalidated").length;
  const rValues = judgeable.map((candidate) => candidate.outcome.resultR);
  const totalR = sumFinite(rValues);
  const equity = equityRisk(judgeable);
  return {
    candidates: candidates.length,
    judgeable: judgeable.length,
    worked,
    invalidated,
    workedRate: judgeable.length === 0 ? 0 : roundNumber(worked / judgeable.length),
    totalR: roundNumber(totalR),
    maxDrawdownR: equity.maxDrawdownR,
    minEquityR: equity.minEquityR,
    averageR: average(rValues),
    medianR: median(rValues),
    averageFirstReactionR: average(candidates.map((candidate) => candidate.outcome.firstReactionR)),
    medianFirstReactionR: median(candidates.map((candidate) => candidate.outcome.firstReactionR)),
    averageTargetR: average(candidates.map((candidate) => candidate.outcome.targetR)),
    medianTargetR: median(candidates.map((candidate) => candidate.outcome.targetR)),
    averageInvalidationBps: average(candidates.map((candidate) => candidate.outcome.invalidationBps)),
    medianInvalidationBps: median(candidates.map((candidate) => candidate.outcome.invalidationBps)),
  };
}

function equityRisk(candidates: ReaderCandidate[]): {
  maxDrawdownR: number;
  minEquityR: number;
} {
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let minEquity = 0;
  const chronological = [...candidates].sort((left, right) => left.observedAt - right.observedAt || left.index - right.index);
  for (const candidate of chronological) {
    const result = candidate.outcome.resultR;
    if (!finiteNumber(result)) continue;
    equity += result;
    peak = Math.max(peak, equity);
    minEquity = Math.min(minEquity, equity);
    maxDrawdown = Math.min(maxDrawdown, equity - peak);
  }
  return {
    maxDrawdownR: roundNumber(maxDrawdown),
    minEquityR: roundNumber(minEquity),
  };
}

function refFor(candidate: ReaderCandidate): string {
  return `${candidate.asset}#${candidate.index}@${new Date(candidate.observedAt).toISOString()}`;
}

function average(values: Array<number | null | undefined>): number | null {
  const finite = sortedFinite(values);
  if (finite.length === 0) return null;
  return round(finite.reduce((sum, value) => sum + value, 0) / finite.length);
}

function median(values: Array<number | null | undefined>): number | null {
  const finite = sortedFinite(values);
  if (finite.length === 0) return null;
  const middle = Math.floor(finite.length / 2);
  if (finite.length % 2 === 1) return finite[middle] ?? null;
  const left = finite[middle - 1];
  const right = finite[middle];
  if (left === undefined || right === undefined) return null;
  return round((left + right) / 2);
}

function sortedFinite(values: Array<number | null | undefined>): number[] {
  return values.filter(finiteNumber).sort((left, right) => left - right);
}

function finiteNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function sumFinite(values: Array<number | null | undefined>): number {
  return values.filter(finiteNumber).reduce((sum, value) => sum + value, 0);
}

function round(value: number | null): number | null {
  if (value === null) return null;
  return roundNumber(value);
}

function roundNumber(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
