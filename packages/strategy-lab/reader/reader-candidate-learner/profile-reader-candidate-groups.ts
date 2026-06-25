import type { ReaderCandidate } from "../reader-candidates/types";
import type { ReaderCandidateReactionFilter, ReaderCandidateReactionSummary } from "./profile-reader-candidate-reactions";

export type ReaderCandidateGroup = {
  key: string;
  summary: ReaderCandidateReactionSummary;
  refs: string[];
};

export type ReaderCandidateGroupProfile = {
  filter: ReaderCandidateReactionFilter;
  minimumGroupSize: number;
  groups: ReaderCandidateGroup[];
};

type GroupSpec = {
  prefix: string;
  keyFor: (candidate: ReaderCandidate) => string;
};

export function profileReaderCandidateGroups(input: {
  candidates: ReaderCandidate[];
  filter?: ReaderCandidateReactionFilter;
  minimumGroupSize: number;
}): ReaderCandidateGroupProfile {
  if (!Number.isInteger(input.minimumGroupSize) || input.minimumGroupSize <= 0) {
    throw new Error("candidate group profile minimumGroupSize must be a positive integer");
  }
  const filter = input.filter ?? {};
  const candidates = input.candidates.filter((candidate) => matchesFilter(candidate, filter));
  const groups = groupSpecs()
    .flatMap((spec) => groupsFor(candidates, spec))
    .filter((group) => group.summary.judgeable >= input.minimumGroupSize)
    .sort(groupRiskFirst);

  return {
    filter,
    minimumGroupSize: input.minimumGroupSize,
    groups,
  };
}

function groupSpecs(): GroupSpec[] {
  return [
    { prefix: "family", keyFor: (candidate) => candidate.family },
    { prefix: "side", keyFor: (candidate) => nullish(candidate.side) },
    { prefix: "builder-response", keyFor: (candidate) => candidate.builder.response },
    { prefix: "auction-location", keyFor: (candidate) => candidate.reader.auctionLocation },
    { prefix: "auction-level", keyFor: (candidate) => nullish(candidate.reader.auctionLevelKind) },
    { prefix: "auction-mode", keyFor: (candidate) => nullish(candidate.reader.auctionMode) },
    { prefix: "auction-phase", keyFor: (candidate) => nullish(candidate.reader.auctionPhase) },
    { prefix: "vp-auction", keyFor: (candidate) => nullish(candidate.reader.vpAuction) },
    { prefix: "vp-poc", keyFor: (candidate) => nullish(candidate.reader.vpPoc) },
    { prefix: "vp-value", keyFor: (candidate) => nullish(candidate.reader.vpValue) },
    { prefix: "regime", keyFor: (candidate) => nullish(candidate.reader.regime) },
    { prefix: "narrative-intent", keyFor: (candidate) => nullish(candidate.reader.narrativeIntent) },
    { prefix: "narrative-direction", keyFor: (candidate) => nullish(candidate.reader.narrativeDirection) },
    { prefix: "local-range", keyFor: (candidate) => nullish(candidate.reader.localRangeLocation) },
    { prefix: "orderflow-pressure", keyFor: (candidate) => candidate.orderflow.pressure },
    { prefix: "orderflow-events", keyFor: (candidate) => eventKey(candidate.orderflow.events) },
    { prefix: "largest-print-side", keyFor: (candidate) => nullish(candidate.orderflow.largestTradeSide) },
    { prefix: "first-reaction", keyFor: (candidate) => candidate.outcome.firstReaction },
    { prefix: "target-r", keyFor: (candidate) => targetRBand(candidate.outcome.targetR) },
    {
      prefix: "first-target-r",
      keyFor: (candidate) => [
        candidate.outcome.firstReaction,
        targetRBand(candidate.outcome.targetR),
      ].join("|"),
    },
    {
      prefix: "builder-local-first",
      keyFor: (candidate) => [
        candidate.builder.response,
        nullish(candidate.reader.localRangeLocation),
        candidate.outcome.firstReaction,
      ].join("|"),
    },
    {
      prefix: "vp-value-local-first",
      keyFor: (candidate) => [
        nullish(candidate.reader.vpValue),
        nullish(candidate.reader.localRangeLocation),
        candidate.outcome.firstReaction,
      ].join("|"),
    },
    {
      prefix: "builder-vp-value-first",
      keyFor: (candidate) => [
        candidate.builder.response,
        nullish(candidate.reader.vpValue),
        candidate.outcome.firstReaction,
      ].join("|"),
    },
  ];
}

function targetRBand(targetR: number | null): string {
  if (targetR === null || !Number.isFinite(targetR)) return "unknown";
  if (targetR < 2) return "target<2R";
  if (targetR < 4) return "target2-4R";
  if (targetR < 6) return "target4-6R";
  return "target>=6R";
}

function groupsFor(candidates: ReaderCandidate[], spec: GroupSpec): ReaderCandidateGroup[] {
  const groups = new Map<string, ReaderCandidate[]>();
  for (const candidate of candidates) {
    const key = `${spec.prefix}|${spec.keyFor(candidate)}`;
    const existing = groups.get(key);
    if (existing) existing.push(candidate);
    else groups.set(key, [candidate]);
  }
  return [...groups.entries()].map(([key, groupCandidates]) => ({
    key,
    summary: summarize(groupCandidates),
    refs: groupCandidates.slice(0, 12).map(refFor),
  }));
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
  const equity = equityRisk(judgeable);
  return {
    candidates: candidates.length,
    judgeable: judgeable.length,
    worked,
    invalidated,
    workedRate: judgeable.length === 0 ? 0 : roundNumber(worked / judgeable.length),
    totalR: roundNumber(sumFinite(rValues)),
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

function groupRiskFirst(left: ReaderCandidateGroup, right: ReaderCandidateGroup): number {
  return left.summary.totalR - right.summary.totalR
    || left.summary.workedRate - right.summary.workedRate
    || left.summary.maxDrawdownR - right.summary.maxDrawdownR
    || right.summary.judgeable - left.summary.judgeable;
}

function eventKey(events: string[]): string {
  return events.length === 0 ? "none" : [...events].sort().join("+");
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

function nullish(value: string | null | undefined): string {
  return value ?? "unknown";
}

function round(value: number | null): number | null {
  if (value === null) return null;
  return roundNumber(value);
}

function roundNumber(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}


