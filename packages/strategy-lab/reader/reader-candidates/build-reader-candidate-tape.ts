import type { LiveReaderRead } from "../reader-live/types";
import type { Side } from "../../types";
import { readReaderCandidate, type ReaderCandidateDraft } from "./read-reader-candidate";
import type {
  BuildReaderCandidateTapeInput,
  ReaderCandidate,
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

    const draft = readReaderCandidate({ observedAt: step.now, setup, resultUpdate });
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

function outcomeFor(input: {
  candidate: ReaderCandidateDraft;
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
  let firstReactionMove: number | null = null;

  for (const step of input.reads) {
    const price = step.read.orderflow.lastPrice;
    if (price === null) continue;
    const move = signedMove(candidate.side, candidate.entryPrice, price);
    if (firstReaction === "none") {
      firstReaction = reactionFor(move);
      firstReactionMove = move;
    }
    maxFavorableMove = Math.max(maxFavorableMove, move);
    maxAdverseMove = Math.min(maxAdverseMove, move);

    if (hitTarget(candidate.side, price, candidate.target)) {
      return {
        verdict: "worked",
        firstReaction,
        firstReactionMove,
        firstReactionR: rMultiple(firstReactionMove, geometry.invalidationDistance),
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
        firstReactionMove,
        firstReactionR: rMultiple(firstReactionMove, geometry.invalidationDistance),
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
    firstReactionMove,
    firstReactionR: rMultiple(firstReactionMove, geometry.invalidationDistance),
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
    firstReactionMove: null,
    firstReactionR: null,
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

function geometryDiagnosticsFor(candidate: ReaderCandidateDraft): Pick<
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

function rMultiple(move: number | null, invalidationDistance: number | null): number | null {
  if (move === null) return null;
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

function candidateKeyFor(candidate: ReaderCandidateDraft): string {
  return [
    candidate.family,
    candidate.side ?? "none",
    candidate.reader.auctionLocation,
    candidate.reader.auctionLevelKind ?? "none",
    candidate.reader.vpAuction ?? "none",
    candidate.reader.vpPoc ?? "none",
    candidate.reader.vpValue ?? "none",
    candidate.reader.localRangeLocation ?? "none",
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



