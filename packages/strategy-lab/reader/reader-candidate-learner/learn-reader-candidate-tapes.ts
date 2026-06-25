import type { ReaderCandidate } from "../reader-candidates/types";
import type {
  ReaderCandidateLearnerGroup,
  ReaderCandidateLearnerGuidance,
  ReaderCandidateLearnerInput,
  ReaderCandidateLearnerLesson,
  ReaderCandidateLearnerReport,
  ReaderCandidateLearnerSummary,
} from "./types";

export function learnReaderCandidateTapes(input: ReaderCandidateLearnerInput): ReaderCandidateLearnerReport {
  const minimumSample = input.minimumSampleForGuidance;
  const candidates = input.tapes.flatMap((tape) => tape.assets.flatMap((asset) => asset.tape.candidates));
  const ignored = candidates.filter((candidate) => candidate.builder.response !== "executed");
  const lessons = groupedCandidates(ignored)
    .map((group) => lessonFor({ group, minimumSample }))
    .sort((left, right) => right.summary.candidates - left.summary.candidates || right.summary.workedRate - left.summary.workedRate);

  return {
    summary: summaryFor(candidates),
    paperPromoteCandidates: ranked(lessons.filter((lesson) => lesson.guidance === "paper-promote-candidate"), "best"),
    futureAvoidCandidates: ranked(lessons.filter((lesson) => lesson.guidance === "future-avoid-candidate"), "worst"),
    builderTooStrictCandidates: ranked(lessons.filter((lesson) => lesson.guidance === "builder-too-strict-candidate"), "best"),
    noiseCandidates: ranked(lessons.filter((lesson) => lesson.guidance === "noise-candidate"), "worst"),
    geometryArtifactCandidates: lessons.filter((lesson) => lesson.guidance === "geometry-artifact-candidate"),
    riskRewardArtifactCandidates: lessons.filter((lesson) => lesson.guidance === "risk-reward-artifact-candidate"),
    thinSampleCandidates: ranked(lessons.filter((lesson) => lesson.guidance === "thin-sample-candidate"), "best"),
    untradeableBalanceCandidates: lessons.filter((lesson) => lesson.guidance === "untradeable-balance-candidate"),
    unjudgeableCandidates: lessons.filter((lesson) => lesson.guidance === "unjudgeable-candidate"),
  };
}

function groupedCandidates(candidates: ReaderCandidate[]): ReaderCandidateLearnerGroup[] {
  const groups = new Map<string, ReaderCandidate[]>();
  for (const candidate of candidates) {
    const key = keyFor(candidate);
    const existing = groups.get(key);
    if (existing) existing.push(candidate);
    else groups.set(key, [candidate]);
  }
  return [...groups.entries()].map(([key, groupCandidates]) => ({ key, candidates: groupCandidates }));
}

function keyFor(candidate: ReaderCandidate): string {
  return [
    candidate.family,
    candidate.side ?? "no-side",
    candidate.reader.auctionLocation,
    candidate.reader.auctionLevelKind ?? "no-level-kind",
    candidate.reader.auctionMode ?? "no-auction-mode",
    candidate.reader.auctionPhase ?? "no-auction-phase",
    candidate.reader.vpAuction ?? "no-vp-auction",
    candidate.reader.vpPoc ?? "no-vp-poc",
    candidate.reader.vpValue ?? "no-vp-value",
    candidate.orderflow.pressure,
    eventFamily(candidate.orderflow.events),
    riskRewardKey(candidate),
    `first=${candidate.outcome.firstReaction}`,
    candidate.builder.response,
  ].join("|");
}

function riskRewardKey(candidate: ReaderCandidate): string {
  if (candidate.outcome.verdict === "unjudgeable") return "rr=unjudgeable";
  if (candidate.outcome.targetR === null) return "rr=invalid-geometry";
  if (candidate.outcome.targetR < 1) return "rr=sub-risk-target";
  return "rr=risk-target";
}

function eventFamily(events: string[]): string {
  if (events.length === 0) return "no-orderflow-event";
  return [...events].sort().join("+");
}

function lessonFor(input: {
  group: ReaderCandidateLearnerGroup;
  minimumSample: number;
}): ReaderCandidateLearnerLesson {
  const summary = summaryFor(input.group.candidates);
  const sampleWarning = summary.judgeable < input.minimumSample
    ? `only ${summary.judgeable} judgeable candidates; use as research, not execution permission`
    : null;
  const guidance = guidanceFor({ group: input.group, summary, minimumSample: input.minimumSample });
  return {
    key: input.group.key,
    guidance,
    summary,
    sampleWarning,
    reasons: reasonsFor({ group: input.group, summary, sampleWarning, guidance }),
    refs: input.group.candidates.slice(0, 12).map(refFor),
  };
}

function guidanceFor(input: {
  group: ReaderCandidateLearnerGroup;
  summary: ReaderCandidateLearnerSummary;
  minimumSample: number;
}): ReaderCandidateLearnerGuidance {
  if (input.group.candidates.every(isUntradeableBalanceCandidate)) return "untradeable-balance-candidate";
  if (input.summary.judgeable === 0) return "unjudgeable-candidate";
  if (input.summary.invalidGeometry > 0) return "geometry-artifact-candidate";
  if (input.summary.subRiskTarget > 0) return "risk-reward-artifact-candidate";
  if (input.summary.judgeable < input.minimumSample) return "thin-sample-candidate";
  if (
    input.summary.worked > input.summary.invalidated
    && (input.summary.medianResultR ?? 0) > 0
    && input.group.candidates.some(isStrictBuilderResponse)
  ) {
    return "builder-too-strict-candidate";
  }
  if (input.summary.worked > input.summary.invalidated) return "paper-promote-candidate";
  if (input.summary.invalidated > input.summary.worked) return "future-avoid-candidate";
  return "noise-candidate";
}

function isStrictBuilderResponse(candidate: ReaderCandidate): boolean {
  return candidate.builder.response === "no-trade" || candidate.builder.response === "ready-if-reclaim";
}

function isUntradeableBalanceCandidate(candidate: ReaderCandidate): boolean {
  return candidate.family === "poc-chop-no-trade" && candidate.side === null;
}

function reasonsFor(input: {
  group: ReaderCandidateLearnerGroup;
  summary: ReaderCandidateLearnerSummary;
  sampleWarning: string | null;
  guidance: ReaderCandidateLearnerGuidance;
}): string[] {
  const reasons: string[] = [];
  if (input.sampleWarning) reasons.push(input.sampleWarning);
  if (input.summary.worked > 0) reasons.push(`${input.summary.worked} ignored candidates reached target geometry`);
  if (input.summary.invalidated > 0) reasons.push(`${input.summary.invalidated} ignored candidates invalidated first`);
  if (input.summary.invalidGeometry > 0) reasons.push(`${input.summary.invalidGeometry} candidates have non-tradeable target/stop geometry`);
  if (input.summary.subRiskTarget > 0) reasons.push(`${input.summary.subRiskTarget} candidates target less than the risk unit`);
  if (input.summary.avgResultR !== null) reasons.push(`average result ${formatR(input.summary.avgResultR)}`);
  if (input.summary.avgFirstReactionR !== null) reasons.push(`average first reaction ${formatR(input.summary.avgFirstReactionR)}`);
  if (input.summary.avgTargetR !== null) reasons.push(`average target ${formatR(input.summary.avgTargetR)}`);
  if (input.summary.avgTargetBps !== null) reasons.push(`average target ${formatBps(input.summary.avgTargetBps)}`);
  if (input.summary.avgInvalidationBps !== null) reasons.push(`average invalidation ${formatBps(input.summary.avgInvalidationBps)}`);
  if (input.summary.medianResultR !== null) reasons.push(`median result ${formatR(input.summary.medianResultR)}`);
  if (input.summary.medianFirstReactionR !== null) reasons.push(`median first reaction ${formatR(input.summary.medianFirstReactionR)}`);
  if (input.summary.medianTargetR !== null) reasons.push(`median target ${formatR(input.summary.medianTargetR)}`);
  if (input.summary.medianInvalidationBps !== null) reasons.push(`median invalidation ${formatBps(input.summary.medianInvalidationBps)}`);
  if (input.summary.minInvalidationBps !== null) reasons.push(`minimum invalidation ${formatBps(input.summary.minInvalidationBps)}`);
  if (input.group.candidates.some(isStrictBuilderResponse)) reasons.push("builder did not execute this candidate family");
  if (input.guidance === "geometry-artifact-candidate") reasons.push("removed from promotion because target/stop geometry is not clean");
  if (input.guidance === "risk-reward-artifact-candidate") reasons.push("removed from promotion because target is below 1R");
  if (input.guidance === "thin-sample-candidate") reasons.push("removed from promotion because the sample is too thin");
  if (input.guidance === "untradeable-balance-candidate") reasons.push("removed from guidance because balanced POC chop has no trade direction");
  if (input.guidance === "unjudgeable-candidate") reasons.push("candidate family lacks directional geometry or profile/level context");
  return reasons;
}

function summaryFor(candidates: ReaderCandidate[]): ReaderCandidateLearnerSummary {
  const worked = candidates.filter((candidate) => candidate.outcome.verdict === "worked").length;
  const invalidated = candidates.filter((candidate) => candidate.outcome.verdict === "invalidated").length;
  const unresolved = candidates.filter((candidate) => candidate.outcome.verdict === "unresolved").length;
  const unjudgeable = candidates.filter((candidate) => candidate.outcome.verdict === "unjudgeable").length;
  const judgeable = worked + invalidated + unresolved;
  const invalidGeometry = candidates.filter((candidate) =>
    candidate.outcome.verdict !== "unjudgeable" && candidate.outcome.targetR === null
  ).length;
  const subRiskTarget = candidates.filter((candidate) =>
    candidate.outcome.verdict !== "unjudgeable"
    && candidate.outcome.targetR !== null
    && candidate.outcome.targetR < 1
  ).length;
  return {
    candidates: candidates.length,
    judgeable,
    worked,
    invalidated,
    unresolved,
    unjudgeable,
    executed: candidates.filter((candidate) => candidate.builder.response === "executed").length,
    workedRate: judgeable === 0 ? 0 : round(worked / judgeable),
    invalidGeometry,
    subRiskTarget,
    avgTargetR: average(candidates.map((candidate) => candidate.outcome.targetR)),
    avgTargetBps: average(candidates.map((candidate) => candidate.outcome.targetBps)),
    avgInvalidationBps: average(candidates.map((candidate) => candidate.outcome.invalidationBps)),
    avgResultR: average(candidates.map((candidate) => candidate.outcome.resultR)),
    avgFirstReactionR: average(candidates.map((candidate) => candidate.outcome.firstReactionR)),
    avgMaxFavorableR: average(candidates.map((candidate) => candidate.outcome.maxFavorableR)),
    avgMaxAdverseR: average(candidates.map((candidate) => candidate.outcome.maxAdverseR)),
    medianTargetR: median(candidates.map((candidate) => candidate.outcome.targetR)),
    medianTargetBps: median(candidates.map((candidate) => candidate.outcome.targetBps)),
    medianInvalidationBps: median(candidates.map((candidate) => candidate.outcome.invalidationBps)),
    medianResultR: median(candidates.map((candidate) => candidate.outcome.resultR)),
    medianFirstReactionR: median(candidates.map((candidate) => candidate.outcome.firstReactionR)),
    minInvalidationBps: minimum(candidates.map((candidate) => candidate.outcome.invalidationBps)),
  };
}

function ranked(lessons: ReaderCandidateLearnerLesson[], order: "best" | "worst"): ReaderCandidateLearnerLesson[] {
  return [...lessons].sort((left, right) => {
    if (order === "best") return scoreFor(right.summary) - scoreFor(left.summary) || right.summary.judgeable - left.summary.judgeable;
    return scoreFor(left.summary) - scoreFor(right.summary) || right.summary.judgeable - left.summary.judgeable;
  });
}

function refFor(candidate: ReaderCandidate): string {
  return `${candidate.asset}#${candidate.index}@${new Date(candidate.observedAt).toISOString()}`;
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function average(values: Array<number | null | undefined>): number | null {
  const finiteValues = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (finiteValues.length === 0) return null;
  return round(finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length);
}

function scoreFor(summary: ReaderCandidateLearnerSummary): number {
  if (summary.medianResultR !== null) return summary.medianResultR;
  if (summary.avgResultR !== null) return summary.avgResultR;
  return summary.workedRate - (summary.invalidGeometry / Math.max(summary.candidates, 1));
}

function formatR(value: number): string {
  return `${value.toFixed(4).replace(/\.?0+$/, "")}R`;
}

function formatBps(value: number): string {
  return `${value.toFixed(4).replace(/\.?0+$/, "")}bps`;
}

function median(values: Array<number | null | undefined>): number | null {
  const finiteValues = sortedFinite(values);
  if (finiteValues.length === 0) return null;
  const middle = Math.floor(finiteValues.length / 2);
  if (finiteValues.length % 2 === 1) return finiteValues[middle] ?? null;
  const left = finiteValues[middle - 1];
  const right = finiteValues[middle];
  if (left === undefined || right === undefined) return null;
  return round((left + right) / 2);
}

function minimum(values: Array<number | null | undefined>): number | null {
  const finiteValues = sortedFinite(values);
  return finiteValues[0] ?? null;
}

function sortedFinite(values: Array<number | null | undefined>): number[] {
  return values
    .filter((value): value is number => value !== null && Number.isFinite(value))
    .sort((left, right) => left - right);
}


