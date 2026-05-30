import type { LiveReaderRead } from "../reader-live/types";
import { applyReaderNarrativeStateToPlan } from "../reader-narrative-state/apply-reader-narrative-state-to-plan";
import { readerNarrativeKeyFor } from "../reader-narrative-state/reader-narrative-key-for";
import { buildReaderTradePlan } from "../trade-plan/build-reader-trade-plan";
import type { ReaderActionableTradePlan, ReaderNoTradePlan, ReaderTradePlan } from "../trade-plan/types";
import { readerSetupKeyFor } from "./reader-setup-key-for";
import type { ReaderSetupConfig, ReaderSetupEvent, ReaderSetupMemory, ReaderSetupResult, ReaderSetupState } from "./types";

export function readMarketSetup(input: {
  read: LiveReaderRead;
  memory: ReaderSetupMemory;
  now?: number;
  config?: ReaderSetupConfig;
}): ReaderSetupResult {
  const now = input.now ?? Date.now();
  const key = readerSetupKeyFor({
    asset: input.read.asset,
    interval: input.read.auction.interval,
    scope: input.config?.keyScope,
  });
  const events: ReaderSetupEvent[] = [];
  expireSetup(input.memory, key, input.read.asset, now, events);

  const previous = input.memory.get(key)?.value ?? null;
  const rawPlan = buildReaderTradePlan(input.read, input.config?.tradePlanConfig);
  const plan = applyReaderNarrativeStateToPlan({
    read: input.read,
    plan: rawPlan,
    state: narrativeStateFor(input.read, now, input.config),
  });
  if (previous && crossedStop(previous.plan, input.read.orderflow.lastPrice)) {
    input.memory.delete(key, "setup invalidated at stop", now);
    const blocked = noTrade(input.read, [`tracked ${previous.side} setup invalidated at stop ${previous.plan.stop}`], previous.plan.setupFamily);
    events.push(setupEvent("setup-invalidated", key, input.read.asset, now, blocked.reasons[0] ?? "setup invalidated"));
    return { read: input.read, plan: blocked, setup: null, events, planSource: "none" };
  }

  if (!isActionable(plan)) {
    if (previous) {
      input.memory.delete(key, "current narrative no longer supports the setup", now);
      events.push(setupEvent("setup-invalidated", key, input.read.asset, now, "current narrative no longer supports the setup"));
    }
    events.push(setupEvent("setup-none", key, input.read.asset, now, plan.reasons[0] ?? "reader found no setup"));
    return { read: input.read, plan, setup: null, events, planSource: "none" };
  }

  const setup = setupFromPlan(key, input.config?.keyScope ?? null, input.read, plan, now, previous);
  input.memory.set(key, setup, { now, ttlMs: input.config?.setupTtlMs, reason: setup.lastReason });
  events.push(setupEvent(eventTypeFor(previous, plan), key, input.read.asset, now, setup.lastReason));
  return { read: input.read, plan, setup, events, planSource: "fresh-read" };
}

function narrativeStateFor(
  read: LiveReaderRead,
  now: number,
  config: ReaderSetupConfig | undefined,
) {
  if (config?.narrativeState?.enabled === false) return null;
  const memory = config?.narrativeState?.memory;
  if (!memory) return null;
  const key = readerNarrativeKeyFor({
    asset: read.asset,
    at: now,
    narrative: read.narrativeRead,
    auction: {
      location: read.auction.location,
      levelKind: read.auction.level?.kind ?? null,
    },
  });
  return key ? memory.get(key)?.value ?? null : null;
}

function expireSetup(
  memory: ReaderSetupMemory,
  key: string,
  asset: string,
  now: number,
  events: ReaderSetupEvent[],
): void {
  const currentEntry = memory.get(key);
  if (!currentEntry || currentEntry.expiresAt === null || currentEntry.expiresAt > now) return;
  memory.delete(key, "setup ttl expired", now);
  events.push(setupEvent("setup-expired", key, asset, now, "setup ttl expired"));
}

function setupFromPlan(
  key: string,
  scope: string | null,
  read: LiveReaderRead,
  plan: ReaderActionableTradePlan,
  now: number,
  previous: ReaderSetupState | null,
): ReaderSetupState {
  return {
    key,
    scope,
    asset: read.asset,
    interval: read.auction.interval,
    side: plan.side,
    status: statusForPlan(plan),
    plan,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    lastReadAt: now,
    readCount: (previous?.readCount ?? 0) + 1,
    lastReason: previous ? "current narrative refreshed tracked setup" : plan.reasons[0] ?? "narrative setup created",
  };
}

function statusForPlan(plan: ReaderActionableTradePlan): ReaderSetupState["status"] {
  if (plan.status === "ready") return "ready";
  if (plan.status === "ready-if-reclaim") return "waiting-reclaim";
  return "watching";
}

function eventTypeFor(previous: ReaderSetupState | null, plan: ReaderActionableTradePlan): ReaderSetupEvent["type"] {
  if (!previous) return plan.status === "ready" ? "setup-ready" : "setup-created";
  if (previous.side !== plan.side || previous.plan.setupFamily !== plan.setupFamily) return "setup-replaced";
  if (plan.status === "ready") return "setup-ready";
  return "setup-held";
}

function crossedStop(plan: ReaderActionableTradePlan, lastPrice: number | null): boolean {
  if (lastPrice === null) return false;
  if (plan.side === "long") return lastPrice <= plan.stop;
  return lastPrice >= plan.stop;
}

function isActionable(plan: ReaderTradePlan): plan is ReaderActionableTradePlan {
  return plan.status !== "no-trade";
}

function noTrade(read: LiveReaderRead, reasons: string[], setupFamily: ReaderNoTradePlan["setupFamily"] = "none"): ReaderNoTradePlan {
  return {
    status: "no-trade",
    asset: read.asset,
    setupFamily,
    regime: read.regime,
    confidence: 0,
    narrative: read.narrativeRead,
    reasons,
  };
}

function setupEvent(type: ReaderSetupEvent["type"], key: string, asset: string, at: number, reason: string): ReaderSetupEvent {
  return { type, key, asset, at, reason };
}
