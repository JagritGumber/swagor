import type { LiveReaderRead } from "../reader-live/types";
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
  const currentEntry = input.memory.get(key);
  if (currentEntry && currentEntry.expiresAt !== null && currentEntry.expiresAt <= now) {
    input.memory.delete(key, "setup ttl expired", now);
    events.push(setupEvent("setup-expired", key, currentEntry.value.asset, now, "setup ttl expired"));
  }

  const previous = input.memory.get(key)?.value ?? null;
  const basePlan = buildReaderTradePlan(input.read, input.config?.tradePlanConfig);
  if (previous && crossedStop(previous.plan, input.read.orderflow.lastPrice)) {
    input.memory.delete(key, "setup invalidated", now);
    const plan = noTrade(input.read.asset, [`tracked ${previous.side} setup invalidated at stop ${previous.plan.stop}`]);
    events.push(setupEvent("setup-invalidated", key, input.read.asset, now, plan.reasons[0] ?? "setup invalidated"));
    return { read: input.read, plan, setup: null, events, planSource: "none" };
  }

  if (previous && lostAuctionContext(previous, input.read, basePlan)) {
    input.memory.delete(key, "setup context changed", now);
    const plan = noTrade(input.read.asset, [`tracked ${previous.side} setup invalidated because auction context changed`]);
    events.push(setupEvent("setup-invalidated", key, input.read.asset, now, plan.reasons[0] ?? "setup invalidated"));
    return { read: input.read, plan, setup: null, events, planSource: "none" };
  }

  if (previous && reclaimedEntry(previous.plan, input.read)) {
    const setup = nextSetup(previous, readyPlan(previous.plan), now, "tracked setup reclaimed entry zone");
    input.memory.set(key, setup, { now, ttlMs: input.config?.setupTtlMs, reason: setup.lastReason });
    events.push(setupEvent("setup-ready", key, input.read.asset, now, setup.lastReason));
    return { read: input.read, plan: setup.plan, setup, events, planSource: "memory-promoted" };
  }

  if (isActionable(basePlan) && shouldUseBasePlan(previous, basePlan)) {
    const setup = setupFromPlan(key, input.config?.keyScope ?? null, input.read, basePlan, now, previous);
    input.memory.set(key, setup, { now, ttlMs: input.config?.setupTtlMs, reason: setup.lastReason });
    events.push(setupEvent(previous ? "setup-replaced" : "setup-created", key, input.read.asset, now, setup.lastReason));
    return { read: input.read, plan: setup.plan, setup, events, planSource: "fresh-read" };
  }

  if (previous) {
    const setup = nextSetup(previous, previous.plan, now, "tracked setup remains valid");
    input.memory.set(key, setup, { now, ttlMs: input.config?.setupTtlMs, reason: setup.lastReason });
    events.push(setupEvent("setup-held", key, input.read.asset, now, setup.lastReason));
    return { read: input.read, plan: setup.plan, setup, events, planSource: "memory-held" };
  }

  events.push(setupEvent("setup-none", key, input.read.asset, now, basePlan.reasons[0] ?? "reader found no setup"));
  return { read: input.read, plan: basePlan, setup: null, events, planSource: "none" };
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
    lastReason: previous ? "stronger reader setup replaced tracked setup" : "reader setup created",
  };
}

function nextSetup(previous: ReaderSetupState, plan: ReaderActionableTradePlan, now: number, reason: string): ReaderSetupState {
  return {
    ...previous,
    status: statusForPlan(plan),
    plan,
    updatedAt: now,
    lastReadAt: now,
    readCount: previous.readCount + 1,
    lastReason: reason,
  };
}

function statusForPlan(plan: ReaderActionableTradePlan): ReaderSetupState["status"] {
  if (plan.status === "ready") return "ready";
  if (plan.status === "ready-if-reclaim") return "waiting-reclaim";
  return "watching";
}

function readyPlan(plan: ReaderActionableTradePlan): ReaderActionableTradePlan {
  return {
    ...plan,
    status: "ready",
    confidence: Math.min(0.9, Number(Math.max(plan.confidence + 0.06, 0.72).toFixed(4))),
    reasons: [...plan.reasons.filter((reason) => reason !== "failed pressure is present but price still needs to reclaim the entry zone"), "tracked setup reclaimed entry zone"],
  };
}

function shouldUseBasePlan(previous: ReaderSetupState | null, basePlan: ReaderActionableTradePlan): boolean {
  if (!previous) return true;
  if (previous.side !== basePlan.side) return basePlan.status !== "watch";
  return planStrength(basePlan.status) >= planStrength(previous.plan.status);
}

function planStrength(status: ReaderActionableTradePlan["status"]): number {
  if (status === "ready") return 3;
  if (status === "ready-if-reclaim") return 2;
  return 1;
}

function crossedStop(plan: ReaderActionableTradePlan, lastPrice: number | null): boolean {
  if (lastPrice === null) return false;
  if (plan.side === "long") return lastPrice <= plan.stop;
  return lastPrice >= plan.stop;
}

function lostAuctionContext(previous: ReaderSetupState, read: LiveReaderRead, basePlan: ReaderTradePlan): boolean {
  if (read.auction.interval !== previous.interval) return true;
  if (!read.auction.level || !read.auction.profile) return true;
  if (read.auction.location === "near-poc" || read.auction.location === "outside-profile") return true;
  if (isActionable(basePlan) && basePlan.side !== previous.side && basePlan.status !== "watch") return false;
  return false;
}

function reclaimedEntry(plan: ReaderActionableTradePlan, read: LiveReaderRead): boolean {
  const lastPrice = read.orderflow.lastPrice;
  if (lastPrice === null || plan.status !== "ready-if-reclaim" || !reclaimOrderflowStillAgrees(plan, read)) return false;
  if (plan.side === "long") return lastPrice >= plan.entryLow;
  return lastPrice <= plan.entryHigh;
}

function reclaimOrderflowStillAgrees(plan: ReaderActionableTradePlan, read: LiveReaderRead): boolean {
  if (plan.side === "long") {
    if (read.orderflow.events.includes("stalled-selling")) return true;
    return read.orderflow.pressure !== "sell-pressure";
  }
  if (read.orderflow.events.includes("stalled-buying")) return true;
  return read.orderflow.pressure !== "buy-pressure";
}

function isActionable(plan: ReaderTradePlan): plan is ReaderActionableTradePlan {
  return plan.status !== "no-trade";
}

function noTrade(asset: string, reasons: string[]): ReaderNoTradePlan {
  return {
    status: "no-trade",
    asset,
    confidence: 0,
    reasons,
  };
}

function setupEvent(type: ReaderSetupEvent["type"], key: string, asset: string, at: number, reason: string): ReaderSetupEvent {
  return { type, key, asset, at, reason };
}
