import { readReaderCandidate, type ReaderCandidateDraft } from "../reader-candidates/read-reader-candidate";
import type { ReaderSetupResult, ReaderSetupState } from "../reader-setup/types";
import type { ReaderActionableTradePlan } from "@strategy-lab/backtest/trade-plan/types";
import type { Side } from "@strategy-lab/types";
import { readerRadarKeyFor } from "./reader-radar-key-for";
import type {
  ReaderRadarCandidate,
  ReaderRadarConfig,
  ReaderRadarEvent,
  ReaderRadarEventType,
  ReaderRadarMemory,
  ReaderRadarUpdate,
} from "./types";

export function updateReaderRadar(input: {
  setup: ReaderSetupResult;
  memory: ReaderRadarMemory;
  config: ReaderRadarConfig;
  now?: number;
}): ReaderRadarUpdate {
  const now = input.now ?? Date.now();
  const events: ReaderRadarEvent[] = [];
  expireStaleCandidates(input.memory, input.setup.read.asset, now, input.config, events);

  const draft = readReaderCandidate({ observedAt: now, setup: input.setup, resultUpdate: null });
  if (!draft) {
    const trackedUpdate = updateTrackedCandidatesFromPrice({
      setup: input.setup,
      memory: input.memory,
      config: input.config,
      now,
      events,
    });
    if (trackedUpdate) return trackedUpdate;
    events.push(event("radar-ignored", ignoredKeyFor(input.setup), input.setup.read.asset, now, "reader produced no directional candidate"));
    return { setup: holdReadySetup(input.setup, input.config, "reader produced no directional candidate to verify before entry", now), candidate: null, events, promoted: false };
  }
  if (!isDirectionalTradeCandidate(draft)) {
    const trackedUpdate = updateTrackedCandidatesFromPrice({
      setup: input.setup,
      memory: input.memory,
      config: input.config,
      now,
      events,
    });
    if (trackedUpdate) return trackedUpdate;
    events.push(event("radar-ignored", readerRadarKeyFor(draft), draft.asset, now, "candidate has no trade direction"));
    return { setup: holdReadySetup(input.setup, input.config, "candidate has no trade direction to verify before entry", now), candidate: null, events, promoted: false };
  }

  const key = readerRadarKeyFor(draft);
  const previous = input.memory.get(key)?.value ?? null;
  if (isInvalidated(draft, input.setup.read.orderflow.lastPrice)) {
    input.memory.delete(key, "candidate invalidated by current last traded price", now);
    events.push(event("radar-killed", key, draft.asset, now, "candidate invalidated by current last traded price"));
    return { setup: holdReadySetup(input.setup, input.config, "candidate invalidated before entry", now), candidate: null, events, promoted: false };
  }

  const candidate = candidateFor({ key, draft, previous, now, setup: input.setup });
  if (shouldRetirePromotedThesis(previous, candidate)) {
    const retiredCandidate = { ...candidate, status: "killed" as const, updatedAt: now, lastReadAt: now, lastReason: "promoted continuation thesis deteriorated after entry" };
    input.memory.delete(key, retiredCandidate.lastReason, now);
    events.push(event("radar-killed", key, draft.asset, now, retiredCandidate.lastReason));
    return { setup: holdReadySetup(input.setup, input.config, retiredCandidate.lastReason, now), candidate: retiredCandidate, events, promoted: false };
  }
  if (shouldKillBeforeEntry(candidate, input.config, input.setup)) {
    const killedCandidate = { ...candidate, status: "killed" as const, updatedAt: now, lastReadAt: now, lastReason: killReasonFor(candidate) };
    input.memory.delete(key, killedCandidate.lastReason, now);
    events.push(event("radar-killed", key, draft.asset, now, killedCandidate.lastReason));
    return { setup: holdReadySetup(input.setup, input.config, killedCandidate.lastReason, now), candidate: killedCandidate, events, promoted: false };
  }

  const eventType = eventTypeFor(candidate, previous);
  input.memory.set(key, candidate, { now, reason: candidate.lastReason });
  events.push(event(eventType, key, draft.asset, now, candidate.lastReason));

  const blockReason = promotionBlockReason({ candidate, setup: input.setup, config: input.config });
  if (blockReason) {
    if (candidate.status === "improving") events.push(event("radar-blocked", key, draft.asset, now, blockReason));
    return { setup: holdReadySetup(input.setup, input.config, "candidate is waiting for live confirmation before entry", now), candidate, events, promoted: false };
  }

  const promotedSetup = promoteSetup(input.setup, candidate, now);
  const promotedCandidate = { ...candidate, status: "promoted" as const, updatedAt: now, lastReadAt: now, lastReason: "radar promoted improving actionable candidate" };
  input.memory.set(key, promotedCandidate, { now, reason: promotedCandidate.lastReason });
  events.push(event("radar-promoted", key, draft.asset, now, promotedCandidate.lastReason));
  return { setup: promotedSetup, candidate: promotedCandidate, events, promoted: true };
}

function expireStaleCandidates(
  memory: ReaderRadarMemory,
  asset: string,
  now: number,
  config: ReaderRadarConfig,
  events: ReaderRadarEvent[],
): void {
  if (config.maxStaleMs === null || config.maxStaleMs === undefined) return;
  for (const entry of memory.snapshot()) {
    if (entry.value.asset !== asset) continue;
    if (now - entry.value.lastReadAt <= config.maxStaleMs) continue;
    memory.delete(entry.key, "radar candidate stale", now);
    events.push(event("radar-expired", entry.key, asset, now, "radar candidate stale"));
  }
}

function isDirectionalTradeCandidate(candidate: ReaderCandidateDraft): boolean {
  return candidate.side !== null
    && candidate.entryPrice !== null
    && candidate.target !== null
    && candidate.invalidation !== null
    && candidate.family !== "poc-chop-no-trade";
}

function isInvalidated(candidate: ReaderCandidateDraft, price: number | null): boolean {
  if (!candidate.side || candidate.invalidation === null || price === null) return false;
  return candidate.side === "long" ? price <= candidate.invalidation : price >= candidate.invalidation;
}

function candidateFor(input: {
  key: string;
  draft: ReaderCandidateDraft;
  previous: ReaderRadarCandidate | null;
  now: number;
  setup: ReaderSetupResult;
}): ReaderRadarCandidate {
  const anchorPrice = input.previous?.anchorPrice ?? input.draft.entryPrice;
  const previousMove = input.previous?.lastMove ?? 0;
  const lastMove = signedMove(input.draft.side, anchorPrice, input.draft.entryPrice);
  const pocDistance = pocDistanceFor(input.setup);
  const previousPocDistance = input.previous?.pocDistance ?? null;
  const pocRotation = pocRotationFor({
    side: input.draft.side,
    previousPrice: input.previous?.candidate.entryPrice ?? null,
    currentPrice: input.draft.entryPrice,
    poc: input.setup.read.auction.profile?.poc ?? null,
    previousDistance: previousPocDistance,
    currentDistance: pocDistance,
  });
  const favorable = lastMove > previousMove;
  const adverse = lastMove < previousMove;
  const repair = repairEvidenceSupportsContinuation(input.draft, input.setup);
  const status = statusForCandidate({
    candidate: input.draft,
    previous: input.previous,
    favorable,
    adverse,
    pocRotation,
  });
  const invalidationEvidence = invalidationEvidenceFor({
    candidate: input.draft,
    setup: input.setup,
    status,
    pocRotation,
  });
  const bestMove = Math.max(input.previous?.bestMove ?? 0, lastMove);
  const worstMove = Math.min(input.previous?.worstMove ?? 0, lastMove);
  return {
    key: input.key,
    asset: input.draft.asset,
    status,
    candidate: input.draft,
    planSnapshot: actionablePlanSnapshot(input.setup, input.previous, input.draft),
    anchorPrice,
    createdAt: input.previous?.createdAt ?? input.now,
    updatedAt: input.now,
    lastReadAt: input.now,
    readCount: (input.previous?.readCount ?? 0) + 1,
    favorableReads: (input.previous?.favorableReads ?? 0) + (favorable ? 1 : 0),
    adverseReads: (input.previous?.adverseReads ?? 0) + (adverse ? 1 : 0),
    repairReads: (input.previous?.repairReads ?? 0) + (repair ? 1 : 0),
    invalidationEvidence: mergeEvidence(input.previous?.invalidationEvidence ?? [], invalidationEvidence),
    pocDistance,
    previousPocDistance,
    pocRotation,
    lastMove,
    bestMove,
    worstMove,
    lastReason: reasonFor(status, input.draft, repair),
  };
}

function updateTrackedCandidatesFromPrice(input: {
  setup: ReaderSetupResult;
  memory: ReaderRadarMemory;
  config: ReaderRadarConfig;
  now: number;
  events: ReaderRadarEvent[];
}): ReaderRadarUpdate | null {
  const price = input.setup.read.orderflow.lastPrice;
  if (price === null) return null;
  const tracked = input.memory.snapshot()
    .filter((entry) => entry.value.asset === input.setup.read.asset)
    .filter((entry) => entry.value.planSnapshot !== null)
    .filter((entry) => entry.value.candidate.family === "trend-continuation")
    .filter((entry) => entry.value.candidate.reader.narrativeIntent === "continuation-pullback")
    .sort((left, right) => right.value.lastReadAt - left.value.lastReadAt);

  for (const entry of tracked) {
    const current = entry.value;
    if (isInvalidated(current.candidate, price)) {
      input.memory.delete(entry.key, "tracked radar candidate invalidated by last traded price", input.now);
      input.events.push(event("radar-killed", entry.key, current.asset, input.now, "tracked radar candidate invalidated by last traded price"));
      continue;
    }

    const updated = trackedCandidateForPrice({
      candidate: current,
      setup: input.setup,
      price,
      now: input.now,
    });
    if (shouldRetirePromotedThesis(current, updated)) {
      const retiredCandidate = { ...updated, status: "killed" as const, updatedAt: input.now, lastReadAt: input.now, lastReason: "promoted continuation thesis deteriorated after entry" };
      input.memory.delete(entry.key, retiredCandidate.lastReason, input.now);
      input.events.push(event("radar-killed", entry.key, current.asset, input.now, retiredCandidate.lastReason));
      continue;
    }
    if (shouldKillBeforeEntry(updated, input.config, input.setup)) {
      const killedCandidate = { ...updated, status: "killed" as const, updatedAt: input.now, lastReadAt: input.now, lastReason: killReasonFor(updated) };
      input.memory.delete(entry.key, killedCandidate.lastReason, input.now);
      input.events.push(event("radar-killed", entry.key, current.asset, input.now, killedCandidate.lastReason));
      continue;
    }

    input.memory.set(entry.key, updated, { now: input.now, reason: updated.lastReason });
    input.events.push(event(eventTypeFor(updated, current), entry.key, current.asset, input.now, updated.lastReason));
    const blockReason = promotionBlockReason({ candidate: updated, setup: input.setup, config: input.config, tracked: true });
    if (blockReason) {
      if (updated.status === "improving") input.events.push(event("radar-blocked", entry.key, current.asset, input.now, blockReason));
      return { setup: holdReadySetup(input.setup, input.config, "tracked candidate is waiting for live confirmation before entry", input.now), candidate: updated, events: input.events, promoted: false };
    }

    const promotedSetup = promoteSetup(input.setup, updated, input.now);
    const promotedCandidate = { ...updated, status: "promoted" as const, updatedAt: input.now, lastReadAt: input.now, lastReason: "radar promoted improving tracked candidate from last traded price" };
    input.memory.set(entry.key, promotedCandidate, { now: input.now, reason: promotedCandidate.lastReason });
    input.events.push(event("radar-promoted", entry.key, current.asset, input.now, promotedCandidate.lastReason));
    return { setup: promotedSetup, candidate: promotedCandidate, events: input.events, promoted: true };
  }

  return null;
}

function trackedCandidateForPrice(input: {
  candidate: ReaderRadarCandidate;
  setup: ReaderSetupResult;
  price: number;
  now: number;
}): ReaderRadarCandidate {
  const lastMove = signedMove(input.candidate.candidate.side, input.candidate.anchorPrice, input.price);
  const previousMove = input.candidate.lastMove;
  const pocDistance = pocDistanceFor(input.setup);
  const pocRotation = pocRotationFor({
    side: input.candidate.candidate.side,
    previousPrice: input.candidate.candidate.entryPrice,
    currentPrice: input.price,
    poc: input.setup.read.auction.profile?.poc ?? null,
    previousDistance: input.candidate.pocDistance,
    currentDistance: pocDistance,
  });
  const favorable = lastMove > previousMove;
  const adverse = lastMove < previousMove;
  const repair = repairEvidenceSupportsContinuation(input.candidate.candidate, input.setup);
  const status = statusForCandidate({
    candidate: input.candidate.candidate,
    previous: input.candidate,
    favorable,
    adverse,
    pocRotation,
  });
  const invalidationEvidence = invalidationEvidenceFor({
    candidate: input.candidate.candidate,
    setup: input.setup,
    status,
    pocRotation,
  });
  return {
    ...input.candidate,
    status,
    updatedAt: input.now,
    lastReadAt: input.now,
    readCount: input.candidate.readCount + 1,
    favorableReads: input.candidate.favorableReads + (favorable ? 1 : 0),
    adverseReads: input.candidate.adverseReads + (adverse ? 1 : 0),
    repairReads: input.candidate.repairReads + (repair ? 1 : 0),
    invalidationEvidence: mergeEvidence(input.candidate.invalidationEvidence, invalidationEvidence),
    previousPocDistance: input.candidate.pocDistance,
    pocDistance,
    pocRotation,
    lastMove,
    bestMove: Math.max(input.candidate.bestMove, lastMove),
    worstMove: Math.min(input.candidate.worstMove, lastMove),
    lastReason: reasonFor(status, input.candidate.candidate, repair),
  };
}

function eventTypeFor(candidate: ReaderRadarCandidate, previous: ReaderRadarCandidate | null): ReaderRadarEventType {
  if (!previous) return "radar-born";
  if (candidate.status === "improving") return "radar-improved";
  if (candidate.status === "deteriorating") return "radar-deteriorated";
  return "radar-updated";
}

function statusForCandidate(input: {
  candidate: ReaderCandidateDraft;
  previous: ReaderRadarCandidate | null;
  favorable: boolean;
  adverse: boolean;
  pocRotation: ReaderRadarCandidate["pocRotation"];
}): ReaderRadarCandidate["status"] {
  if (!input.previous) return "watching";
  if (input.candidate.reader.narrativeIntent === "continuation-pullback") {
    if (input.favorable && input.pocRotation !== "away-from-poc") return "improving";
    if (input.adverse || input.pocRotation === "away-from-poc") return "deteriorating";
    return "watching";
  }
  if (input.candidate.family === "trend-continuation") {
    if (input.favorable) return "improving";
    if (input.adverse) return "deteriorating";
    return "watching";
  }
  if (input.favorable && input.pocRotation !== "away-from-poc") return "improving";
  if (input.adverse || input.pocRotation === "away-from-poc") return "deteriorating";
  return "watching";
}

function shouldPromote(input: {
  candidate: ReaderRadarCandidate;
  setup: ReaderSetupResult;
  config: ReaderRadarConfig;
  tracked?: boolean;
}): boolean {
  return promotionBlockReason(input) === null;
}

function promotionBlockReason(input: {
  candidate: ReaderRadarCandidate;
  setup: ReaderSetupResult;
  config: ReaderRadarConfig;
  tracked?: boolean;
}): string | null {
  if (input.config.mode !== "execute") return "radar is not in execute mode";
  const styleBlockReason = tradeStyleBlockReason(input.candidate.candidate, input.config.tradeStyle ?? "all");
  if (styleBlockReason) return styleBlockReason;
  const planBlockReason = promotablePlanBlockReason(input.setup, input.candidate);
  if (planBlockReason) return planBlockReason;
  const currentReadBlockReason = continuationCurrentReadBlockReason(input.candidate, input.setup);
  if (currentReadBlockReason) return currentReadBlockReason;
  if (input.candidate.status !== "improving") return `candidate status is ${input.candidate.status}`;
  if (input.candidate.adverseReads > 0 && !candidateHasEntryRepairAfterAdverse(input.candidate, input.setup)) return "candidate has unrepaired adverse live reads";
  const invalidationBlockReason = continuationInvalidationBlockReason(input.candidate, input.setup);
  if (invalidationBlockReason) return invalidationBlockReason;
  if (!tradeStyleHasSustainedContinuation(input.candidate, input.config.tradeStyle ?? "all")) return "continuation pullback needs sustained favorable live reads";
  if (!hasContinuationPocRotationIntegrity(input.candidate)) return `candidate lacks POC rotation integrity: ${input.candidate.pocRotation}`;
  if (input.tracked) {
    const trackedBlockReason = trackedContinuationPullbackBlockReason(input.candidate, input.setup);
    if (trackedBlockReason) return trackedBlockReason;
  } else if (!continuationPullbackCanPromote(input.candidate, input.setup)) return "fresh continuation no longer has live support";
  const supportBlockReason = continuationSupportZoneBlockReason(input.candidate.candidate.side, input.setup);
  if (supportBlockReason) return supportBlockReason;
  const chopBlockReason = continuationChopBlockReason(input.setup);
  if (chopBlockReason) return chopBlockReason;
  if (!orderflowSupports(input.candidate.candidate, input.setup)) return "current orderflow does not support candidate side";
  if (input.candidate.bestMove <= 0) return "candidate has not moved favorably";
  return null;
}

function tradeStyleHasSustainedContinuation(
  candidate: ReaderRadarCandidate,
  style: NonNullable<ReaderRadarConfig["tradeStyle"]>,
): boolean {
  if (style !== "trend-long-pullback-only" && style !== "trend-short-pullback-only") return true;
  if (!isContinuationPullback(candidate.candidate)) return true;
  if (candidateRepairedAfterAdverse(candidate)) return true;
  return candidate.favorableReads >= 2;
}

function tradeStyleBlockReason(candidate: ReaderCandidateDraft, style: NonNullable<ReaderRadarConfig["tradeStyle"]>): string | null {
  if (candidateMatchesTradeStyle(candidate, style)) return null;
  return `reader radar ${style} blocks ${candidate.family}/${candidate.side ?? "none"} candidate`;
}

function candidateMatchesTradeStyle(candidate: ReaderCandidateDraft, style: NonNullable<ReaderRadarConfig["tradeStyle"]>): boolean {
  if (style === "all") return true;
  if (style === "trend-only") return candidate.family === "trend-continuation" || candidate.family === "initiative-continuation";
  if (style === "trend-breakout-only") return candidate.family === "initiative-continuation";
  if (style === "trend-pullback-only") return isContinuationPullback(candidate);
  if (style === "trend-long-pullback-only") return isContinuationPullback(candidate) && candidate.side === "long";
  if (style === "trend-short-pullback-only") return isContinuationPullback(candidate) && candidate.side === "short";
  if (style === "reversal-only") return candidate.family !== "trend-continuation" && candidate.family !== "initiative-continuation";
  return true;
}

function continuationPullbackCanPromote(
  candidate: ReaderRadarCandidate,
  setup: ReaderSetupResult,
): boolean {
  if (candidate.candidate.family !== "trend-continuation") return true;
  if (candidate.candidate.reader.narrativeIntent !== "continuation-pullback") return true;
  if (!currentNarrativeStillSupportsContinuation(candidate.candidate.side, setup)) return false;
  if (continuationInitiativeIsFailing(candidate.candidate.side, setup)) return false;
  if (!localRangeSupportsContinuation(candidate, setup)) return false;
  if (candidate.candidate.side === "long") {
    return setup.read.auction.location === "value-low" && setup.read.auction.level?.kind === "support";
  }
  if (candidate.candidate.side === "short") {
    return setup.read.auction.location === "value-high" && setup.read.auction.level?.kind === "resistance";
  }
  return false;
}

function trackedContinuationPullbackBlockReason(
  candidate: ReaderRadarCandidate,
  setup: ReaderSetupResult,
): string | null {
  if (candidate.candidate.family !== "trend-continuation") return null;
  if (candidate.candidate.reader.narrativeIntent !== "continuation-pullback") return null;
  if (continuationInitiativeIsFailing(candidate.candidate.side, setup)) return "tracked continuation initiative is failing";
  if (!localRangeSupportsContinuation(candidate, setup)) return "tracked continuation local range no longer supports entry";
  const objectiveBlockReason = continuationObjectiveZoneBlockReason(candidate.candidate.side, setup);
  if (objectiveBlockReason) return objectiveBlockReason;
  return neutralTrackedContinuationBlockReason(candidate.candidate.side, setup);
}

function continuationObjectiveZoneBlockReason(side: Side | null, setup: ReaderSetupResult): string | null {
  if (setup.read.auction.location !== "near-poc") return null;
  const levelKind = setup.read.auction.level?.kind ?? null;
  const vpValue = setup.read.vpState?.value ?? null;
  const regime = setup.read.regime?.mode ?? null;
  if (side === "long") {
    if (levelKind === "support" && regime === "range") return "long continuation blocked at POC support in range regime";
    if (levelKind === "resistance") return "long continuation blocked after rotating into POC resistance";
    if (vpValue === "value-expanding-down") return "long continuation blocked after rotating into POC while value expands down";
  }
  if (side === "short") {
    if (levelKind === "support") return "short continuation blocked after rotating into POC support";
    if (vpValue === "value-expanding-up") return "short continuation blocked after rotating into POC while value expands up";
  }
  return null;
}

function continuationSupportZoneBlockReason(side: Side | null, setup: ReaderSetupResult): string | null {
  if (setup.read.auction.location !== "value-low") return null;
  if (setup.read.auction.level?.kind !== "support") return null;
  const regime = setup.read.regime?.mode;
  if (side === "long" && regime && regime !== "trend-down") {
    return "long continuation support reclaim needs downside expansion regime";
  }
  return null;
}

function continuationChopBlockReason(setup: ReaderSetupResult): string | null {
  if (setup.read.auctionMode?.mode === "violent-unknown" || setup.read.auctionMode?.phase === "violent-chop") {
    return "continuation blocked in violent chop";
  }
  const vp = setup.read.vpState;
  if (vp?.auction === "poc-chop" && vp.poc === "poc-stable") return "continuation blocked in stable POC chop";
  return null;
}

function neutralTrackedContinuationBlockReason(side: Side | null, setup: ReaderSetupResult): string | null {
  const narrative = setup.read.narrativeRead;
  if ((narrative?.intent ?? "wait") !== "wait" || (narrative?.direction ?? "none") !== "none") return null;
  const vpValue = setup.read.vpState?.value;
  if (side === "long" && vpValue === "value-expanding-up") {
    return "neutral long continuation blocked while value is still expanding up";
  }
  if (side === "short" && vpValue === "value-expanding-down") {
    return "neutral short continuation blocked while value is still expanding down";
  }
  const initiative = setup.read.orderflow.initiative;
  if (setup.read.auctionMode?.mode === "balanced-value" && initiative?.side === sideSide(side) && initiative.conviction !== "overwhelming") {
    return "neutral balanced continuation needs overwhelming initiative";
  }
  return null;
}

function continuationCurrentReadBlockReason(candidate: ReaderRadarCandidate, setup: ReaderSetupResult): string | null {
  if (!isContinuationPullback(candidate.candidate)) return null;
  const narrative = setup.read.narrativeRead;
  const neutralNarrative = (narrative?.intent ?? "wait") === "wait" && (narrative?.direction ?? "none") === "none";
  if (
    neutralNarrative
    && setup.read.stance === "avoid-balanced-auction"
    && setup.read.auction.location === "near-poc"
  ) {
    return "continuation blocked because current read avoids balanced auction near POC";
  }
  return null;
}

function sideSide(side: Side | null): "buy" | "sell" | null {
  if (side === "long") return "buy";
  if (side === "short") return "sell";
  return null;
}

function localRangeSupportsContinuation(candidate: ReaderRadarCandidate, setup: ReaderSetupResult): boolean {
  const location = setup.read.localRange?.location;
  if (!location || location === "unknown") return true;
  if (setup.read.regime?.mode === "range" && location === "middle") return false;
  if (location === "middle") return candidate.status === "improving" && candidate.adverseReads === 0 && candidate.bestMove > 0;
  if (candidate.candidate.side === "long") return location === "lower-edge";
  if (candidate.candidate.side === "short") return location === "upper-edge";
  return false;
}

function invalidationEvidenceFor(input: {
  candidate: ReaderCandidateDraft;
  setup: ReaderSetupResult;
  status: ReaderRadarCandidate["status"];
  pocRotation: ReaderRadarCandidate["pocRotation"];
}): string[] {
  if (input.candidate.family !== "trend-continuation") return [];
  if (input.candidate.reader.narrativeIntent !== "continuation-pullback") return [];
  const evidence: string[] = [];
  if (input.status === "deteriorating") evidence.push("live read moved against the thesis");
  if (input.pocRotation === "away-from-poc") evidence.push("price rotated away from POC before entry");
  const locationEvidence = localRangeInvalidationEvidence(input.candidate.side, input.setup);
  if (locationEvidence) evidence.push(locationEvidence);
  if (absorptionFailedToRotate(input.candidate, input.setup, input.pocRotation)) evidence.push("absorption did not create rotation toward POC");
  return evidence;
}

function localRangeInvalidationEvidence(side: Side | null, setup: ReaderSetupResult): string | null {
  const location = setup.read.localRange?.location;
  if (!location || location === "unknown") return null;
  if (side === "long" && location === "upper-edge") return "long continuation reached the opposite local range edge";
  if (side === "short" && location === "lower-edge") return "short continuation reached the opposite local range edge";
  return null;
}

function localRangeStructurallyOpposesContinuation(side: Side | null, setup: ReaderSetupResult): boolean {
  const location = setup.read.localRange?.location;
  if (!location || location === "unknown") return false;
  if (side === "long") return location === "upper-edge";
  if (side === "short") return location === "lower-edge";
  return false;
}

function currentOrderflowOpposesContinuation(side: Side | null, setup: ReaderSetupResult): boolean {
  if (!side) return true;
  const read = setup.read.orderflow;
  const largestSide = read.largestTrade?.side ?? null;
  const initiativeSide = read.initiative?.side ?? "none";
  const events = new Set(read.events);
  if (side === "long") {
    return read.pressure === "sell-pressure"
      && (largestSide === "sell" || initiativeSide === "sell" || events.has("buy-absorption") || events.has("stalled-buying"));
  }
  return read.pressure === "buy-pressure"
    && (largestSide === "buy" || initiativeSide === "buy" || events.has("sell-absorption") || events.has("stalled-selling"));
}

function absorptionFailedToRotate(
  candidate: ReaderCandidateDraft,
  setup: ReaderSetupResult,
  pocRotation: ReaderRadarCandidate["pocRotation"],
): boolean {
  if (pocRotation !== "away-from-poc") return false;
  const events = new Set(setup.read.orderflow.events);
  if (!events.has("aggressive-absorption") && !events.has("confirmed-absorption")) return false;
  if (candidate.side === "long") return events.has("sell-absorption") || events.has("stalled-selling");
  if (candidate.side === "short") return events.has("buy-absorption") || events.has("stalled-buying");
  return false;
}

function mergeEvidence(existing: string[], next: string[]): string[] {
  return [...new Set([...existing, ...next])];
}

function currentNarrativeStillSupportsContinuation(side: Side | null, setup: ReaderSetupResult): boolean {
  const narrative = setup.read.narrativeRead;
  if (!narrative || side === null) return false;
  return narrative.intent === "continuation-pullback" && narrative.direction === side;
}

function continuationInitiativeIsFailing(side: Side | null, setup: ReaderSetupResult): boolean {
  if (setup.read.absorptionQuality?.quality === "churn") return true;
  const events = new Set(setup.read.orderflow.events);
  if (side === "long") return events.has("buy-absorption") || events.has("stalled-buying");
  if (side === "short") return events.has("sell-absorption") || events.has("stalled-selling");
  return true;
}

function shouldKillBeforeEntry(candidate: ReaderRadarCandidate, config: ReaderRadarConfig, setup: ReaderSetupResult): boolean {
  if (config.mode !== "execute") return false;
  if (candidate.readCount <= 1) return false;
  if (isContinuationPullback(candidate.candidate)) return continuationStructureInvalidated(candidate, setup);
  if (candidate.status === "deteriorating" && repairEvidenceSupportsContinuation(candidate.candidate, setup)) return false;
  if (continuationNarrativeInvalidated(candidate)) return true;
  return candidate.status === "deteriorating";
}

function shouldRetirePromotedThesis(previous: ReaderRadarCandidate | null, candidate: ReaderRadarCandidate): boolean {
  if (previous?.status !== "promoted") return false;
  if (!isContinuationPullback(candidate.candidate)) return false;
  return candidate.status === "deteriorating";
}

function continuationNarrativeInvalidated(candidate: ReaderRadarCandidate): boolean {
  if (!isContinuationPullback(candidate.candidate)) return false;
  if (candidateRepairedAfterAdverse(candidate)) return false;
  return candidate.invalidationEvidence.length >= 2;
}

function continuationInvalidationBlockReason(candidate: ReaderRadarCandidate, setup: ReaderSetupResult): string | null {
  if (!isContinuationPullback(candidate.candidate)) return null;
  if (candidate.invalidationEvidence.length === 0) return null;
  if (candidateRepairedAfterAdverse(candidate) || repairEvidenceSupportsContinuation(candidate.candidate, setup)) return null;
  if (candidate.candidate.reader.localRangeLocation === "middle") {
    return "middle-range continuation has unresolved invalidation evidence";
  }
  return null;
}

function continuationStructureInvalidated(candidate: ReaderRadarCandidate, setup: ReaderSetupResult): boolean {
  if (!isContinuationPullback(candidate.candidate)) return false;
  if (repairEvidenceSupportsContinuation(candidate.candidate, setup)) return false;
  if (candidateRepairedAfterAdverse(candidate)) return false;
  if (!currentOrderflowOpposesContinuation(candidate.candidate.side, setup)) return false;
  if (localRangeStructurallyOpposesContinuation(candidate.candidate.side, setup)) return true;
  return candidate.pocRotation === "away-from-poc" && !currentNarrativeStillSupportsContinuation(candidate.candidate.side, setup);
}

function isContinuationPullback(candidate: ReaderCandidateDraft): boolean {
  return candidate.family === "trend-continuation" && candidate.reader.narrativeIntent === "continuation-pullback";
}

function promoteSetup(setup: ReaderSetupResult, candidate: ReaderRadarCandidate, now: number): ReaderSetupResult {
  const basePlan = promotablePlan(setup, candidate);
  if (!basePlan) return setup;
  const plan: ReaderActionableTradePlan = {
    ...basePlan,
    status: "ready",
    reasons: [...basePlan.reasons, candidate.lastReason],
  };
  const setupState: ReaderSetupState | null = setup.setup
    ? {
        ...setup.setup,
        status: "ready",
        plan,
        updatedAt: now,
        lastReadAt: now,
        lastReason: candidate.lastReason,
      }
    : null;
  return {
    ...setup,
    plan,
    setup: setupState,
    planSource: "memory-promoted",
  };
}

function actionablePlanSnapshot(
  setup: ReaderSetupResult,
  previous: ReaderRadarCandidate | null,
  draft: ReaderCandidateDraft,
): ReaderActionableTradePlan | null {
  if (setup.plan.status !== "no-trade") return setup.plan;
  return previous?.planSnapshot ?? continuationPullbackCandidatePlan(setup, draft);
}

function continuationPullbackCandidatePlan(
  setup: ReaderSetupResult,
  candidate: ReaderCandidateDraft,
): ReaderActionableTradePlan | null {
  if (candidate.family !== "trend-continuation") return null;
  if (candidate.reader.narrativeIntent !== "continuation-pullback") return null;
  if (!candidate.side || candidate.entryPrice === null || candidate.target === null || candidate.invalidation === null) return null;
  const halfWidth = Math.abs(candidate.entryPrice - candidate.invalidation);
  if (!Number.isFinite(halfWidth) || halfWidth <= 0) return null;
  return {
    status: "watch",
    asset: candidate.asset,
    setupFamily: "trend-continuation",
    regime: setup.plan.regime ?? setup.read.regime,
    sequencePhase: setup.plan.sequencePhase,
    sequenceReason: setup.plan.sequenceReason,
    side: candidate.side,
    entryLow: candidate.side === "long" ? candidate.entryPrice : candidate.entryPrice - halfWidth,
    entryHigh: candidate.side === "long" ? candidate.entryPrice + halfWidth : candidate.entryPrice,
    stop: candidate.invalidation,
    target: candidate.target,
    invalidation: candidate.side === "long"
      ? `Long continuation candidate is invalid below ${candidate.invalidation.toFixed(2)}.`
      : `Short continuation candidate is invalid above ${candidate.invalidation.toFixed(2)}.`,
    confidence: 0,
    narrative: setup.plan.narrative ?? setup.read.narrativeRead,
    reasons: [
      "absorption-blocked continuation candidate is tracked for live confirmation",
      ...setup.plan.reasons,
    ],
  };
}

function promotablePlan(
  setup: ReaderSetupResult,
  candidate: ReaderRadarCandidate,
): ReaderActionableTradePlan | null {
  if (promotablePlanBlockReason(setup, candidate)) return null;
  return setup.plan.status !== "no-trade" ? setup.plan : candidate.planSnapshot;
}

function promotablePlanBlockReason(
  setup: ReaderSetupResult,
  candidate: ReaderRadarCandidate,
): string | null {
  if (setup.plan.status !== "no-trade") return null;
  if (candidate.planSnapshot === null) return "candidate has no promotable plan snapshot";
  if (liveNarrativeRejectsSetup(setup)) return "live narrative rejects tracked setup";
  if (isTrackedContinuationPullback(candidate)) return null;
  if (!snapshotTargetStillFitsCurrentAuction(setup, candidate.planSnapshot)) return "tracked setup target no longer fits current auction";
  return null;
}

function isTrackedContinuationPullback(candidate: ReaderRadarCandidate): boolean {
  return candidate.planSnapshot !== null
    && candidate.candidate.family === "trend-continuation"
    && candidate.candidate.reader.narrativeIntent === "continuation-pullback";
}

function liveNarrativeRejectsSetup(setup: ReaderSetupResult): boolean {
  return setup.plan.status === "no-trade"
    && setup.plan.reasons.some((reason) => reason.includes("narrative thesis is invalidated") || reason.includes("narrative thesis is wrong-for-session"));
}

function snapshotTargetStillFitsCurrentAuction(
  setup: ReaderSetupResult,
  plan: ReaderActionableTradePlan | null,
): boolean {
  if (!plan) return false;
  const auctionMode = setup.read.auctionMode;
  if (!auctionMode || (auctionMode.mode !== "balanced-value" && auctionMode.mode !== "poc-gravity" && auctionMode.mode !== "failed-expansion")) {
    return true;
  }
  const profile = setup.read.auction.profile;
  const price = setup.read.orderflow.lastPrice;
  if (!profile || price === null) return false;
  const tolerance = profile.binSize / 2;
  if (!Number.isFinite(tolerance) || tolerance <= 0) return false;
  if (plan.side === "long") {
    return price < profile.poc && Math.abs(plan.target - profile.poc) <= tolerance;
  }
  return price > profile.poc && Math.abs(plan.target - profile.poc) <= tolerance;
}

function orderflowSupports(candidate: ReaderCandidateDraft, setup: ReaderSetupResult): boolean {
  if (repairEvidenceSupportsContinuation(candidate, setup)) return true;
  if (candidate.family === "trend-continuation" && candidate.reader.narrativeIntent === "continuation-pullback") {
    if (candidate.side === "long" && candidate.orderflow.largestTradeSide === "sell") return false;
    if (candidate.side === "short" && candidate.orderflow.largestTradeSide === "buy") return false;
  }
  const events = candidate.orderflow.events.join("|");
  if (candidate.side === "long") {
    return candidate.orderflow.pressure === "balanced"
      || candidate.orderflow.pressure === "buy-pressure"
      || events.includes("stalled-selling");
  }
  if (candidate.side === "short") {
    return candidate.orderflow.pressure === "balanced"
      || candidate.orderflow.pressure === "sell-pressure"
      || events.includes("stalled-buying");
  }
  return false;
}

function candidateRepairedAfterAdverse(candidate: ReaderRadarCandidate): boolean {
  return candidate.candidate.family === "trend-continuation"
    && candidate.candidate.reader.narrativeIntent === "continuation-pullback"
    && candidate.favorableReads > 0
    && candidate.repairReads > 0;
}

function candidateHasEntryRepairAfterAdverse(candidate: ReaderRadarCandidate, setup: ReaderSetupResult): boolean {
  if (candidateRepairedAfterAdverse(candidate)) return true;
  if (!isContinuationPullback(candidate.candidate)) return false;
  if (candidate.adverseReads <= 0 || candidate.favorableReads <= 0) return false;
  if (setup.read.regime?.mode === "range") return false;
  return candidate.bestMove > 0 && (candidate.pocRotation === "toward-poc" || candidate.pocRotation === "through-poc");
}

function hasContinuationPocRotationIntegrity(candidate: ReaderRadarCandidate): boolean {
  if (candidate.candidate.family !== "trend-continuation") return true;
  if (candidate.candidate.reader.narrativeIntent !== "continuation-pullback") return true;
  if (candidateRepairedAfterAdverse(candidate)) return true;
  return candidate.pocRotation === "toward-poc" || candidate.pocRotation === "through-poc";
}

function repairEvidenceSupportsContinuation(
  candidate: ReaderCandidateDraft,
  setup: ReaderSetupResult,
): boolean {
  if (candidate.family !== "trend-continuation") return false;
  if (candidate.reader.narrativeIntent !== "continuation-pullback") return false;
  if (!candidate.side) return false;
  const quality = setup.read.absorptionQuality;
  if (!quality) return false;
  return quality.quality === "trap-confirmed"
    && quality.side === candidate.side
    && quality.targetMovesTowardPoc;
}

function holdReadySetup(
  setup: ReaderSetupResult,
  config: ReaderRadarConfig,
  reason: string,
  now: number,
): ReaderSetupResult {
  if (config.mode !== "execute") return setup;
  if (setup.plan.status !== "ready") return setup;
  const plan: ReaderActionableTradePlan = {
    ...setup.plan,
    status: "watch",
    reasons: [...setup.plan.reasons, reason],
  };
  return {
    ...setup,
    plan,
    setup: setup.setup
      ? {
          ...setup.setup,
          status: "watching",
          plan,
          updatedAt: now,
          lastReadAt: now,
          lastReason: reason,
        }
      : setup.setup,
    planSource: "memory-held",
  };
}

function reasonFor(status: ReaderRadarCandidate["status"], candidate: ReaderCandidateDraft, repair: boolean): string {
  if (repair) return `${candidate.family} candidate has confirmed trap repair while reader keeps watching`;
  if (status === "improving") return `${candidate.family} candidate improving while reader keeps watching`;
  if (status === "deteriorating") return `${candidate.family} candidate deteriorating before entry`;
  return `${candidate.family} candidate tracked by reader radar`;
}

function killReasonFor(candidate: ReaderRadarCandidate): string {
  if (continuationNarrativeInvalidated(candidate)) {
    return `trend-continuation candidate killed because live narrative invalidated: ${candidate.invalidationEvidence.join("; ")}`;
  }
  if (candidate.candidate.family !== "trend-continuation" && candidate.pocRotation === "away-from-poc") {
    return `${candidate.candidate.family} candidate killed because price rotated away from POC before entry`;
  }
  return `${candidate.candidate.family} candidate killed because first live confirmation moved against the thesis`;
}

function signedMove(side: Side | null, entry: number | null, price: number | null): number {
  if (!side || entry === null || price === null) return 0;
  return side === "long" ? price - entry : entry - price;
}

function pocDistanceFor(setup: ReaderSetupResult): number | null {
  const price = setup.read.orderflow.lastPrice;
  const poc = setup.read.auction.profile?.poc ?? null;
  if (price === null || poc === null) return null;
  return Math.abs(price - poc);
}

function pocRotationFor(input: {
  side: Side | null;
  previousPrice: number | null;
  currentPrice: number | null;
  poc: number | null;
  previousDistance: number | null;
  currentDistance: number | null;
}): ReaderRadarCandidate["pocRotation"] {
  if (input.previousPrice === null || input.currentPrice === null || input.poc === null || input.previousDistance === null || input.currentDistance === null) {
    return "no-poc";
  }
  if ((input.previousPrice <= input.poc && input.currentPrice >= input.poc) || (input.previousPrice >= input.poc && input.currentPrice <= input.poc)) {
    return "through-poc";
  }
  if (input.currentDistance < input.previousDistance) return "toward-poc";
  if (input.currentDistance > input.previousDistance) return "away-from-poc";
  return "no-poc";
}

function ignoredKeyFor(setup: ReaderSetupResult): string {
  return `${setup.read.asset}|${setup.read.auction.interval}|ignored`;
}

function event(type: ReaderRadarEventType, key: string, asset: string, at: number, reason: string): ReaderRadarEvent {
  return { type, key, asset, at, reason };
}



