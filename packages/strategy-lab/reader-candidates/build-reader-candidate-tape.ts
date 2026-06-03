import type { LiveReaderRead } from "../reader-live/types";
import type { ReaderResultUpdate } from "../reader-result/types";
import type { ReaderSetupResult } from "../reader-setup/types";
import type { ReaderActionableTradePlan } from "../trade-plan/types";
import type { Side } from "../types";
import type {
  BuildReaderCandidateTapeInput,
  ReaderCandidate,
  ReaderCandidateBuilderResponse,
  ReaderCandidateFamily,
  ReaderCandidateOutcome,
  ReaderCandidateTape,
} from "./types";

export function buildReaderCandidateTape(input: BuildReaderCandidateTapeInput): ReaderCandidateTape {
  const candidates: ReaderCandidate[] = [];
  let previousKey: string | null = null;

  for (let index = 0; index < input.historySteps.length; index += 1) {
    const step = input.historySteps[index];
    const setup = input.setupResults[index];
    const resultUpdate = input.resultUpdates[index];
    if (!step || !setup || !resultUpdate) continue;

    const draft = candidateDraftFor(step.now, setup, resultUpdate);
    if (!draft) {
      previousKey = null;
      continue;
    }
    const key = candidateKeyFor(draft);
    if (key === previousKey) continue;
    previousKey = key;

    candidates.push({
      index: candidates.length + 1,
      ...draft,
      outcome: outcomeFor({
        candidate: draft,
        reads: input.historySteps.slice(index + 1),
      }),
    });
  }

  return {
    summary: summaryFor(candidates),
    candidates,
  };
}

type CandidateDraft = Omit<ReaderCandidate, "index" | "outcome">;

function candidateDraftFor(
  observedAt: number,
  setup: ReaderSetupResult,
  resultUpdate: ReaderResultUpdate,
): CandidateDraft | null {
  const read = setup.read;
  const family = familyFor(read, setup);
  if (!family) return null;
  const side = sideFor(read, setup, family);
  const entryPrice = read.orderflow.lastPrice;
  const geometry = geometryFor(read, setup, side);
  if (!isRecordableCandidate({ family, side, entryPrice, geometry })) return null;
  const response = builderResponseFor(setup, resultUpdate);

  return {
    asset: read.asset,
    observedAt,
    family,
    side,
    entryPrice,
    target: geometry.target,
    invalidation: geometry.invalidation,
    reader: {
      auctionLocation: read.auction.location,
      auctionLevelKind: read.auction.level?.kind ?? null,
      auctionMode: read.auctionMode?.mode ?? null,
      auctionPhase: read.auctionMode?.phase ?? null,
      vpAuction: read.vpState?.auction ?? null,
      vpPoc: read.vpState?.poc ?? null,
      vpValue: read.vpState?.value ?? null,
      regime: read.regime?.mode ?? null,
      narrativeIntent: read.narrativeRead?.intent ?? null,
      narrativeDirection: read.narrativeRead?.direction ?? null,
    },
    orderflow: {
      pressure: read.orderflow.pressure,
      events: read.orderflow.events,
      tradeCount: read.orderflow.tradeCount,
      largestTradeSide: read.orderflow.largestTrade?.side ?? null,
    },
    builder: {
      response,
      setupFamily: setup.plan.setupFamily ?? null,
      reasons: setup.plan.reasons,
    },
  };
}

function isRecordableCandidate(input: {
  family: ReaderCandidateFamily;
  side: Side | null;
  entryPrice: number | null;
  geometry: { target: number | null; invalidation: number | null };
}): boolean {
  if (input.family === "poc-chop-no-trade" && input.side === null) return true;
  if (!input.side || input.entryPrice === null || input.geometry.target === null || input.geometry.invalidation === null) {
    return false;
  }
  return isTradeableGeometry({
    side: input.side,
    entryPrice: input.entryPrice,
    target: input.geometry.target,
    invalidation: input.geometry.invalidation,
  });
}

function familyFor(read: LiveReaderRead, setup: ReaderSetupResult): ReaderCandidateFamily | null {
  if (read.auction.location === "near-poc") return "poc-chop-no-trade";
  if (read.narrativeRead?.intent === "breakout-continuation") return "initiative-continuation";
  if (read.orderflow.events.some((event) => event.includes("absorption"))) return "absorption-reaction";
  if (read.auction.location === "value-high") return "value-high-reaction";
  if (read.auction.location === "value-low") return "value-low-reaction";
  if (setup.plan.status !== "no-trade" && setup.plan.setupFamily === "breakout-acceptance") return "initiative-continuation";
  return null;
}

function sideFor(
  read: LiveReaderRead,
  setup: ReaderSetupResult,
  family: ReaderCandidateFamily,
): Side | null {
  if (setup.plan.status !== "no-trade") return setup.plan.side;
  if (read.narrativeRead?.direction === "long" || read.narrativeRead?.direction === "short") return read.narrativeRead.direction;
  if (family === "value-high-reaction") return "short";
  if (family === "value-low-reaction") return "long";
  if (family === "absorption-reaction") {
    if (read.orderflow.pressure === "buy-pressure") return "short";
    if (read.orderflow.pressure === "sell-pressure") return "long";
  }
  return null;
}

function geometryFor(
  read: LiveReaderRead,
  setup: ReaderSetupResult,
  side: Side | null,
): { target: number | null; invalidation: number | null } {
  if (setup.plan.status !== "no-trade") {
    return {
      target: setup.plan.target,
      invalidation: setup.plan.stop,
    };
  }
  if (!side || !read.auction.profile || !read.auction.level) return { target: null, invalidation: null };
  const profile = read.auction.profile;
  if (side === "long") {
    return {
      target: profile.poc > read.auction.level.price ? profile.poc : profile.valueAreaHigh,
      invalidation: read.auction.level.price,
    };
  }
  return {
    target: profile.poc < read.auction.level.price ? profile.poc : profile.valueAreaLow,
    invalidation: read.auction.level.price,
  };
}

function isTradeableGeometry(input: {
  side: Side;
  entryPrice: number;
  target: number;
  invalidation: number;
}): boolean {
  return signedMove(input.side, input.entryPrice, input.target) > 0
    && signedMove(input.side, input.invalidation, input.entryPrice) > 0;
}

function builderResponseFor(
  setup: ReaderSetupResult,
  resultUpdate: ReaderResultUpdate,
): ReaderCandidateBuilderResponse {
  if (resultUpdate.opened) return "executed";
  return setup.plan.status;
}

function outcomeFor(input: {
  candidate: CandidateDraft;
  reads: Array<{ now: number; read: LiveReaderRead }>;
}): ReaderCandidate["outcome"] {
  const candidate = input.candidate;
  if (!candidate.side || candidate.entryPrice === null || candidate.target === null || candidate.invalidation === null) {
    return emptyOutcome("unjudgeable");
  }

  const geometry = geometryDiagnosticsFor(candidate);
  let maxFavorableMove = 0;
  let maxAdverseMove = 0;
  let firstReaction: ReaderCandidate["outcome"]["firstReaction"] = "none";

  for (const step of input.reads) {
    const price = step.read.orderflow.lastPrice;
    if (price === null) continue;
    const move = signedMove(candidate.side, candidate.entryPrice, price);
    if (firstReaction === "none") firstReaction = reactionFor(move);
    maxFavorableMove = Math.max(maxFavorableMove, move);
    maxAdverseMove = Math.min(maxAdverseMove, move);

    if (hitTarget(candidate.side, price, candidate.target)) {
      return {
        verdict: "worked",
        firstReaction,
        ...geometry,
        maxFavorableMove,
        maxAdverseMove,
        maxFavorableR: rMultiple(maxFavorableMove, geometry.invalidationDistance),
        maxAdverseR: rMultiple(maxAdverseMove, geometry.invalidationDistance),
        resultR: geometry.targetR,
        reachedAt: step.now,
        invalidatedAt: null,
      };
    }
    if (hitInvalidation(candidate.side, price, candidate.invalidation)) {
      return {
        verdict: "invalidated",
        firstReaction,
        ...geometry,
        maxFavorableMove,
        maxAdverseMove,
        maxFavorableR: rMultiple(maxFavorableMove, geometry.invalidationDistance),
        maxAdverseR: rMultiple(maxAdverseMove, geometry.invalidationDistance),
        resultR: geometry.invalidationDistance === null ? null : -1,
        reachedAt: null,
        invalidatedAt: step.now,
      };
    }
  }

  return {
    verdict: "unresolved",
    firstReaction,
    ...geometry,
    maxFavorableMove,
    maxAdverseMove,
    maxFavorableR: rMultiple(maxFavorableMove, geometry.invalidationDistance),
    maxAdverseR: rMultiple(maxAdverseMove, geometry.invalidationDistance),
    resultR: null,
    reachedAt: null,
    invalidatedAt: null,
  };
}

function emptyOutcome(verdict: ReaderCandidateOutcome): ReaderCandidate["outcome"] {
  return {
    verdict,
    firstReaction: "none",
    targetDistance: null,
    invalidationDistance: null,
    targetBps: null,
    invalidationBps: null,
    targetR: null,
    maxFavorableMove: null,
    maxAdverseMove: null,
    maxFavorableR: null,
    maxAdverseR: null,
    resultR: null,
    reachedAt: null,
    invalidatedAt: null,
  };
}

function geometryDiagnosticsFor(candidate: CandidateDraft): Pick<
  ReaderCandidate["outcome"],
  "targetDistance" | "invalidationDistance" | "targetR"
  | "targetBps" | "invalidationBps"
> {
  if (!candidate.side || candidate.entryPrice === null || candidate.target === null || candidate.invalidation === null) {
    return {
      targetDistance: null,
      invalidationDistance: null,
      targetBps: null,
      invalidationBps: null,
      targetR: null,
    };
  }

  const targetDistance = signedMove(candidate.side, candidate.entryPrice, candidate.target);
  const invalidationDistance = -signedMove(candidate.side, candidate.entryPrice, candidate.invalidation);
  const targetBps = bpsFor(targetDistance, candidate.entryPrice);
  const invalidationBps = bpsFor(invalidationDistance, candidate.entryPrice);
  if (targetDistance <= 0 || invalidationDistance <= 0) {
    return {
      targetDistance,
      invalidationDistance,
      targetBps,
      invalidationBps,
      targetR: null,
    };
  }

  return {
    targetDistance,
    invalidationDistance,
    targetBps,
    invalidationBps,
    targetR: round(targetDistance / invalidationDistance),
  };
}

function rMultiple(move: number, invalidationDistance: number | null): number | null {
  if (invalidationDistance === null || invalidationDistance <= 0) return null;
  return round(move / invalidationDistance);
}

function bpsFor(distance: number, entryPrice: number): number | null {
  if (entryPrice <= 0) return null;
  return round((distance / entryPrice) * 10_000);
}

function signedMove(side: Side, entry: number, price: number): number {
  return side === "long" ? price - entry : entry - price;
}

function reactionFor(move: number): ReaderCandidate["outcome"]["firstReaction"] {
  if (move > 0) return "favorable";
  if (move < 0) return "adverse";
  return "flat";
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function hitTarget(side: Side, price: number, target: number): boolean {
  return side === "long" ? price >= target : price <= target;
}

function hitInvalidation(side: Side, price: number, invalidation: number): boolean {
  return side === "long" ? price <= invalidation : price >= invalidation;
}

function candidateKeyFor(candidate: CandidateDraft): string {
  return [
    candidate.family,
    candidate.side ?? "none",
    candidate.reader.auctionLocation,
    candidate.reader.auctionLevelKind ?? "none",
    candidate.reader.vpAuction ?? "none",
    candidate.reader.vpPoc ?? "none",
    candidate.reader.vpValue ?? "none",
    candidate.orderflow.pressure,
    candidate.orderflow.events.join("+") || "none",
    candidate.builder.response,
  ].join("|");
}

function summaryFor(candidates: ReaderCandidate[]): ReaderCandidateTape["summary"] {
  return {
    candidates: candidates.length,
    directional: candidates.filter((candidate) => candidate.side !== null).length,
    nonDirectional: candidates.filter((candidate) => candidate.side === null).length,
    worked: candidates.filter((candidate) => candidate.outcome.verdict === "worked").length,
    invalidated: candidates.filter((candidate) => candidate.outcome.verdict === "invalidated").length,
    unresolved: candidates.filter((candidate) => candidate.outcome.verdict === "unresolved").length,
    unjudgeable: candidates.filter((candidate) => candidate.outcome.verdict === "unjudgeable").length,
    executed: candidates.filter((candidate) => candidate.builder.response === "executed").length,
  };
}
