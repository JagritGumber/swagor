import type { ReaderSetupResult } from "../reader-setup/types";
import { readerNarrativeKeyFor } from "../reader-narrative-state/reader-narrative-key-for";
import type { ReaderActionableTradePlan } from "../trade-plan/types";
import { readerResultForPrice } from "./reader-result-for-price";
import type { ReaderResultEntry, ReaderResultEvent, ReaderResultState, ReaderResultUpdate } from "./types";

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
    const outcome = readerResultForPrice({ entry: input.state.open, price, at: now });
    if (outcome) {
      input.state.open = null;
      input.state.outcomes.push(outcome);
      closed = outcome;
      events.push({
        type: outcome.exitReason === "target" ? "target-hit" : "stop-hit",
        asset: outcome.asset,
        side: outcome.side,
        price: outcome.exitPrice,
        r: outcome.r,
        at: now,
        reason: `${outcome.exitReason} hit`,
      });
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
    stop: plan.stop,
    target: plan.target,
    confidence: plan.confidence,
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
