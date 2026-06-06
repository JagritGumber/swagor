import { readReaderCandidate, type ReaderCandidateDraft } from "../reader-candidates/read-reader-candidate";
import type { ReaderSetupResult, ReaderSetupState } from "../reader-setup/types";
import type { ReaderActionableTradePlan } from "../trade-plan/types";
import type { Side } from "../types";
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
    events.push(event("radar-ignored", ignoredKeyFor(input.setup), input.setup.read.asset, now, "reader produced no directional candidate"));
    return { setup: input.setup, candidate: null, events, promoted: false };
  }
  if (!isDirectionalTradeCandidate(draft)) {
    events.push(event("radar-ignored", readerRadarKeyFor(draft), draft.asset, now, "candidate has no trade direction"));
    return { setup: input.setup, candidate: null, events, promoted: false };
  }

  const key = readerRadarKeyFor(draft);
  const previous = input.memory.get(key)?.value ?? null;
  if (isInvalidated(draft, input.setup.read.orderflow.lastPrice)) {
    input.memory.delete(key, "candidate invalidated by current last traded price", now);
    events.push(event("radar-killed", key, draft.asset, now, "candidate invalidated by current last traded price"));
    return { setup: input.setup, candidate: null, events, promoted: false };
  }

  const candidate = candidateFor({ key, draft, previous, now });
  const eventType = eventTypeFor(candidate, previous);
  input.memory.set(key, candidate, { now, reason: candidate.lastReason });
  events.push(event(eventType, key, draft.asset, now, candidate.lastReason));

  if (!shouldPromote({ candidate, setup: input.setup, config: input.config })) {
    return { setup: input.setup, candidate, events, promoted: false };
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
}): ReaderRadarCandidate {
  const move = signedMove(input.draft.side, input.draft.entryPrice, input.draft.entryPrice);
  const previousMove = input.previous?.lastMove ?? 0;
  const lastMove = input.previous ? signedMove(input.draft.side, input.previous.candidate.entryPrice, input.draft.entryPrice) : move;
  const favorable = lastMove > previousMove;
  const adverse = lastMove < previousMove;
  const status = !input.previous ? "watching" : favorable ? "improving" : adverse ? "deteriorating" : "watching";
  const bestMove = Math.max(input.previous?.bestMove ?? 0, lastMove);
  const worstMove = Math.min(input.previous?.worstMove ?? 0, lastMove);
  return {
    key: input.key,
    asset: input.draft.asset,
    status,
    candidate: input.draft,
    createdAt: input.previous?.createdAt ?? input.now,
    updatedAt: input.now,
    lastReadAt: input.now,
    readCount: (input.previous?.readCount ?? 0) + 1,
    favorableReads: (input.previous?.favorableReads ?? 0) + (favorable ? 1 : 0),
    adverseReads: (input.previous?.adverseReads ?? 0) + (adverse ? 1 : 0),
    lastMove,
    bestMove,
    worstMove,
    lastReason: reasonFor(status, input.draft),
  };
}

function eventTypeFor(candidate: ReaderRadarCandidate, previous: ReaderRadarCandidate | null): ReaderRadarEventType {
  if (!previous) return "radar-born";
  if (candidate.status === "improving") return "radar-improved";
  if (candidate.status === "deteriorating") return "radar-deteriorated";
  return "radar-updated";
}

function shouldPromote(input: {
  candidate: ReaderRadarCandidate;
  setup: ReaderSetupResult;
  config: ReaderRadarConfig;
}): boolean {
  if (input.config.mode !== "execute") return false;
  if (input.setup.plan.status !== "ready-if-reclaim" && input.setup.plan.status !== "watch") return false;
  if (input.candidate.status !== "improving") return false;
  if (!orderflowSupports(input.candidate.candidate)) return false;
  return input.candidate.bestMove > 0;
}

function promoteSetup(setup: ReaderSetupResult, candidate: ReaderRadarCandidate, now: number): ReaderSetupResult {
  if (setup.plan.status === "no-trade") return setup;
  const plan: ReaderActionableTradePlan = {
    ...setup.plan,
    status: "ready",
    reasons: [...setup.plan.reasons, candidate.lastReason],
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

function orderflowSupports(candidate: ReaderCandidateDraft): boolean {
  const events = candidate.orderflow.events.join("|");
  if (candidate.side === "long") {
    return candidate.orderflow.pressure === "balanced"
      || candidate.orderflow.pressure === "buy-pressure"
      || events.includes("stalled-selling")
      || events.includes("absorption");
  }
  if (candidate.side === "short") {
    return candidate.orderflow.pressure === "balanced"
      || candidate.orderflow.pressure === "sell-pressure"
      || events.includes("stalled-buying")
      || events.includes("absorption");
  }
  return false;
}

function reasonFor(status: ReaderRadarCandidate["status"], candidate: ReaderCandidateDraft): string {
  if (status === "improving") return `${candidate.family} candidate improving while reader keeps watching`;
  if (status === "deteriorating") return `${candidate.family} candidate deteriorating before entry`;
  return `${candidate.family} candidate tracked by reader radar`;
}

function signedMove(side: Side | null, entry: number | null, price: number | null): number {
  if (!side || entry === null || price === null) return 0;
  return side === "long" ? price - entry : entry - price;
}

function ignoredKeyFor(setup: ReaderSetupResult): string {
  return `${setup.read.asset}|${setup.read.auction.interval}|ignored`;
}

function event(type: ReaderRadarEventType, key: string, asset: string, at: number, reason: string): ReaderRadarEvent {
  return { type, key, asset, at, reason };
}
