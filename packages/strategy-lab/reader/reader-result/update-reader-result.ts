import type { ReaderSetupResult } from "../reader-setup/types";
import { readerNarrativeKeyFor } from "../reader-narrative-state/reader-narrative-key-for";
import type { ReaderActionableTradePlan } from "../../bt-core/trade-plan/types";
import { readerResultForPrice } from "./reader-result-for-price";
import type { ReaderResultEntry, ReaderResultEvent, ReaderResultOutcome, ReaderResultState, ReaderResultUpdate } from "./types";

export function updateReaderResult(input: {
  state: ReaderResultState;
  result: ReaderSetupResult;
  now?: number;
}): ReaderResultUpdate {
  const now = input.now ?? Date.now();
  const price = input.result.read.orderflow.lastPrice;
  const events: ReaderResultEvent[] = [];
  let opened: ReaderResultEntry | null = null;
  let closed: ReaderResultUpdate["closed"] = null;

  if (input.state.open && price !== null) {
    input.state.open = markPricedObservation(input.state.open, price);
    const outcome = readerResultForPrice({ entry: input.state.open, price, at: now });
    if (outcome) {
      input.state.open = null;
      input.state.outcomes.push(outcome);
      closed = outcome;
      events.push(outcomeEvent(outcome, now));
      appendEvents(input.state, events);
      return { input: input.result, state: input.state, events, opened, closed };
    }

    const readerFailure = readerFailureOutcomeForPrice(input.state.open, input.result, price, now);
    if (readerFailure) {
      input.state.open = null;
      input.state.outcomes.push(readerFailure);
      closed = readerFailure;
      events.push(outcomeEvent(readerFailure, now));
      appendEvents(input.state, events);
      return { input: input.result, state: input.state, events, opened, closed };
    }

    events.push({
      type: "position-held",
      asset: input.state.open.asset,
      side: input.state.open.side,
      price,
      at: now,
      reason: "open reader entry has not hit stop or target",
    });
    appendEvents(input.state, events);
    return { input: input.result, state: input.state, events, opened, closed };
  }

  if (input.state.open) {
    events.push({
      type: "position-unpriced",
      asset: input.state.open.asset,
      side: input.state.open.side,
      at: now,
      reason: "reader result has no last traded price for exit check",
    });
    appendEvents(input.state, events);
    return { input: input.result, state: input.state, events, opened, closed };
  }

  if (input.result.plan.status !== "ready") {
    return { input: input.result, state: input.state, events, opened, closed };
  }

  if (price === null) {
    events.push({
      type: "entry-skipped",
      asset: input.result.read.asset,
      at: now,
      reason: "ready reader plan has no last traded price",
    });
    appendEvents(input.state, events);
    return { input: input.result, state: input.state, events, opened, closed };
  }

  const entry = entryFromPlan(input.result, input.result.plan, price, now);
  if (!entry) {
    events.push({
      type: "entry-skipped",
      asset: input.result.read.asset,
      at: now,
      reason: "ready reader plan has invalid risk",
    });
    appendEvents(input.state, events);
    return { input: input.result, state: input.state, events, opened, closed };
  }

  input.state.open = entry;
  opened = entry;
  events.push({
    type: "entry-opened",
    asset: entry.asset,
    side: entry.side,
    price: entry.entryPrice,
    at: now,
    reason: "ready reader setup opened at last traded price",
  });
  appendEvents(input.state, events);
  return { input: input.result, state: input.state, events, opened, closed };
}

function readerFailureOutcomeForPrice(
  entry: ReaderResultEntry,
  result: ReaderSetupResult,
  price: number,
  at: number,
): ReaderResultOutcome | null {
  const risk = Math.abs(entry.entryPrice - entry.stop);
  if (!Number.isFinite(risk) || risk <= 0) return null;
  const pnl = entry.side === "long" ? price - entry.entryPrice : entry.entryPrice - price;
  const structureFailed = readerStructureFailed(entry, result);
  if (pnl >= 0 && !structureFailed) return null;
  if (pnl < 0 && !structureFailed && !readerFollowThroughFailed(entry)) return null;
  return {
    ...entry,
    exitPrice: price,
    exitAt: at,
    exitReason: "reader-failure",
    r: Number((pnl / risk).toFixed(4)),
  };
}

function markPricedObservation(entry: ReaderResultEntry, price: number): ReaderResultEntry {
  const risk = Math.abs(entry.entryPrice - entry.stop);
  const pricedReadsAfterEntry = (entry.pricedReadsAfterEntry ?? 0) + 1;
  if (!Number.isFinite(risk) || risk <= 0) return { ...entry, pricedReadsAfterEntry };
  const pnl = entry.side === "long" ? price - entry.entryPrice : entry.entryPrice - price;
  const moveR = pnl / risk;
  return {
    ...entry,
    pricedReadsAfterEntry,
    bestFavorableR: Math.max(entry.bestFavorableR ?? 0, moveR),
  };
}

function readerFollowThroughFailed(entry: ReaderResultEntry): boolean {
  return entry.pricedReadsAfterEntry === 1 || (entry.bestFavorableR ?? 0) > 0;
}

function readerStructureFailed(entry: ReaderResultEntry, result: ReaderSetupResult): boolean {
  const currentLocation = result.read.auction.location;
  const currentLevelKind = result.read.auction.level?.kind ?? null;
  const currentDirection = result.read.narrativeRead?.direction ?? null;
  if (!auctionZoneSupportsSide(entry.side, currentLocation)) return true;
  if (currentLevelKind !== null && entry.entryAuctionLevelKind !== null && currentLevelKind !== entry.entryAuctionLevelKind) return true;
  return currentDirection !== null && currentDirection !== "none" && currentDirection !== entry.side;
}

function auctionZoneSupportsSide(side: ReaderResultEntry["side"], location: string): boolean {
  if (side === "long") return location === "below-value" || location === "value-low";
  return location === "above-value" || location === "value-high";
}

function outcomeEvent(outcome: ReaderResultOutcome, at: number): ReaderResultEvent {
  if (outcome.exitReason === "target") {
    return {
      type: "target-hit",
      asset: outcome.asset,
      side: outcome.side,
      price: outcome.exitPrice,
      r: outcome.r,
      at,
      reason: "target hit",
    };
  }
  if (outcome.exitReason === "reader-failure") {
    return {
      type: "reader-failure-exit",
      asset: outcome.asset,
      side: outcome.side,
      price: outcome.exitPrice,
      r: outcome.r,
      at,
      reason: "reader moved against the open thesis before stop or target",
    };
  }
  return {
    type: "stop-hit",
    asset: outcome.asset,
    side: outcome.side,
    price: outcome.exitPrice,
    r: outcome.r,
    at,
    reason: "stop hit",
  };
}

function entryFromPlan(
  result: ReaderSetupResult,
  plan: ReaderActionableTradePlan,
  entryPrice: number,
  entryAt: number,
): ReaderResultEntry | null {
  const risk = Math.abs(entryPrice - plan.stop);
  if (!Number.isFinite(risk) || risk <= 0) return null;
  if (plan.side === "long" && !(plan.stop < entryPrice && entryPrice < plan.target)) return null;
  if (plan.side === "short" && !(plan.target < entryPrice && entryPrice < plan.stop)) return null;
  return {
    asset: plan.asset,
    setupKey: result.setup?.key ?? null,
    setupFamily: plan.setupFamily,
    regime: plan.regime,
    sequencePhase: plan.sequencePhase,
    sequenceReason: plan.sequenceReason,
    side: plan.side,
    entryPrice,
    entryAt,
    entryAuctionLocation: result.read.auction.location,
    entryAuctionLevelKind: result.read.auction.level?.kind ?? null,
    stop: plan.stop,
    target: plan.target,
    confidence: plan.confidence,
    bestFavorableR: 0,
    pricedReadsAfterEntry: 0,
    auctionMode: result.read.auctionMode,
    narrative: plan.narrative,
    narrativeKey: readerNarrativeKeyFor({
      asset: plan.asset,
      at: entryAt,
      narrative: plan.narrative,
      auction: {
        location: result.read.auction.location,
        levelKind: result.read.auction.level?.kind ?? null,
      },
      sessionMode: result.narrativeStateConfig?.sessionMode,
      session: result.narrativeStateConfig?.session,
    }),
    reasons: plan.reasons,
  };
}

function appendEvents(state: ReaderResultState, events: ReaderResultEvent[]): void {
  state.events.push(...events);
  if (state.events.length > state.maxEvents) {
    state.events.splice(0, state.events.length - state.maxEvents);
  }
}


