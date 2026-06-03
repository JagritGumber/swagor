import type { ReaderCandidate } from "../reader-candidates/types";
import type {
  ReaderCandidateLearnerGroup,
  ReaderCandidateLearnerGuidance,
  ReaderCandidateLearnerInput,
  ReaderCandidateLearnerLesson,
  ReaderCandidateLearnerReport,
  ReaderCandidateLearnerSummary,
} from "./types";

const DEFAULT_MINIMUM_SAMPLE_FOR_GUIDANCE = 20;

export function learnReaderCandidateTapes(input: ReaderCandidateLearnerInput): ReaderCandidateLearnerReport {
  const minimumSample = input.minimumSampleForGuidance ?? DEFAULT_MINIMUM_SAMPLE_FOR_GUIDANCE;
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
    candidate.builder.response,
  ].join("|");
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
  const guidance = guidanceFor({ group: input.group, summary });
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
}): ReaderCandidateLearnerGuidance {
  if (input.group.candidates.every(isUntradeableBalanceCandidate)) return "untradeable-balance-candidate";
  if (input.summary.judgeable === 0) return "unjudgeable-candidate";
  if (input.summary.invalidGeometry > 0) return "geometry-artifact-candidate";
  if (input.summary.worked > input.summary.invalidated && input.group.candidates.some(isStrictBuilderResponse)) {
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
  if (input.summary.avgResultR !== null) reasons.push(`average result ${formatR(input.summary.avgResultR)}`);
  if (input.summary.avgTargetR !== null) reasons.push(`average target ${formatR(input.summary.avgTargetR)}`);
  if (input.summary.avgTargetBps !== null) reasons.push(`average target ${formatBps(input.summary.avgTargetBps)}`);
  if (input.summary.avgInvalidationBps !== null) reasons.push(`average invalidation ${formatBps(input.summary.avgInvalidationBps)}`);
  if (input.group.candidates.some(isStrictBuilderResponse)) reasons.push("builder did not execute this candidate family");
  if (input.guidance === "geometry-artifact-candidate") reasons.push("removed from promotion because target/stop geometry is not clean");
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
    avgTargetR: average(candidates.map((candidate) => candidate.outcome.targetR)),
    avgTargetBps: average(candidates.map((candidate) => candidate.outcome.targetBps)),
    avgInvalidationBps: average(candidates.map((candidate) => candidate.outcome.invalidationBps)),
    avgResultR: average(candidates.map((candidate) => candidate.outcome.resultR)),
    avgMaxFavorableR: average(candidates.map((candidate) => candidate.outcome.maxFavorableR)),
    avgMaxAdverseR: average(candidates.map((candidate) => candidate.outcome.maxAdverseR)),
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

function average(values: Array<number | null>): number | null {
  const finiteValues = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (finiteValues.length === 0) return null;
  return round(finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length);
}

function scoreFor(summary: ReaderCandidateLearnerSummary): number {
  if (summary.avgResultR !== null) return summary.avgResultR;
  return summary.workedRate - (summary.invalidGeometry / Math.max(summary.candidates, 1));
}

function formatR(value: number): string {
  return `${value.toFixed(4).replace(/\.?0+$/, "")}R`;
}

function formatBps(value: number): string {
  return `${value.toFixed(4).replace(/\.?0+$/, "")}bps`;
}
