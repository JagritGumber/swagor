import type { ReaderMarketRegime } from "../market-regime/types";
import { readReaderNarrative } from "../reader-narrative/read-reader-narrative";
import type { ReaderNarrative } from "../reader-narrative/types";
import type { Side } from "../types";
import type { LiveReaderRead } from "../reader-live/types";
import type { ReaderActionableTradePlan, ReaderSetupFamily, ReaderTradePlan, ReaderTradePlanConfig } from "./types";

export function buildReaderTradePlan(read: LiveReaderRead, _config: ReaderTradePlanConfig = {}): ReaderTradePlan {
  const narrative = narrativeFor(read);
  const reasons = baseNoTradeReasons(read, narrative);
  if (reasons.length > 0) return noTrade(read, reasons);

  if (narrative.intent === "breakout-watch" || narrative.intent === "reversal-watch") {
    return watchPlan(read, narrative);
  }
  if (narrative.intent === "breakout-continuation") {
    return readyPlan(read, narrative, "breakout-acceptance");
  }
  if (narrative.intent === "reversal-reclaim") {
    return reclaimPlan(read, narrative);
  }
  if (narrative.intent === "continuation-pullback") {
    return watchPlan(read, narrative);
  }

  return noTrade(read, narrative.reasons.length > 0 ? narrative.reasons : ["narrative does not allow a trade"]);
}

function baseNoTradeReasons(read: LiveReaderRead, narrative: ReaderNarrative): string[] {
  const reasons: string[] = [];
  if (!read.auction.level) reasons.push("auction has no active support/resistance level");
  if (!read.auction.profile) reasons.push("auction has no local volume profile");
  if (read.orderflow.lastPrice === null) reasons.push("orderflow has no last traded price");
  if (narrative.intent === "wait") reasons.push(...narrative.reasons);
  return dedupe(reasons);
}

function watchPlan(read: LiveReaderRead, narrative: ReaderNarrative): ReaderTradePlan {
  const side = narrativeSide(narrative);
  if (!side) return noTrade(read, narrative.reasons);
  const levels = planLevels(read, side, narrative);
  if (!levels) return noTrade(read, ["narrative is watchable but numeric auction levels are incomplete"], familyFor(narrative));
  return actionablePlan({
    read,
    narrative,
    side,
    setupFamily: familyFor(narrative),
    status: narrative.intent === "reversal-watch" ? "ready-if-reclaim" : "watch",
    levels,
  });
}

function reclaimPlan(read: LiveReaderRead, narrative: ReaderNarrative): ReaderTradePlan {
  const side = narrativeSide(narrative);
  if (!side) return noTrade(read, narrative.reasons);
  const levels = planLevels(read, side, narrative);
  if (!levels) return noTrade(read, ["narrative allows reclaim but numeric auction levels are incomplete"], "reversal-reclaim");
  return actionablePlan({
    read,
    narrative,
    side,
    setupFamily: "reversal-reclaim",
    status: reclaimed(read, side) ? "ready" : "ready-if-reclaim",
    levels,
  });
}

function readyPlan(read: LiveReaderRead, narrative: ReaderNarrative, setupFamily: ReaderSetupFamily): ReaderTradePlan {
  const side = narrativeSide(narrative);
  if (!side) return noTrade(read, narrative.reasons, setupFamily);
  const levels = planLevels(read, side, narrative);
  if (!levels) return noTrade(read, ["narrative allows continuation but numeric auction levels are incomplete"], setupFamily);
  return actionablePlan({
    read,
    narrative,
    side,
    setupFamily,
    status: "ready",
    levels,
  });
}

function actionablePlan(input: {
  read: LiveReaderRead;
  narrative: ReaderNarrative;
  side: Side;
  setupFamily: ReaderSetupFamily;
  status: ReaderActionableTradePlan["status"];
  levels: PlanLevels;
}): ReaderActionableTradePlan {
  return {
    status: input.status,
    asset: input.read.asset,
    setupFamily: input.setupFamily,
    regime: regimeFor(input.read),
    side: input.side,
    entryLow: input.levels.entryLow,
    entryHigh: input.levels.entryHigh,
    stop: input.levels.stop,
    target: input.levels.target,
    invalidation: input.narrative.invalidation ?? invalidationFor(input.side, input.levels.stop),
    confidence: 0,
    narrative: input.narrative,
    reasons: reasonsFor(input.read, input.narrative, input.setupFamily),
  };
}

type PlanLevels = {
  entryLow: number;
  entryHigh: number;
  stop: number;
  target: number;
};

function planLevels(read: LiveReaderRead, side: Side, narrative: ReaderNarrative): PlanLevels | null {
  const level = read.auction.level;
  const profile = read.auction.profile;
  const lastPrice = read.orderflow.lastPrice;
  if (!level || !profile || lastPrice === null) return null;

  const zoneHalfWidth = profile.binSize / 2;
  if (!Number.isFinite(zoneHalfWidth) || zoneHalfWidth <= 0) return null;

  if (narrative.intent === "breakout-continuation") {
    return breakoutLevels(read, side, zoneHalfWidth);
  }

  const entryLow = level.price - zoneHalfWidth;
  const entryHigh = level.price + zoneHalfWidth;
  const stop = side === "long" ? entryLow - zoneHalfWidth : entryHigh + zoneHalfWidth;
  const target = targetFor(side, entryLow, entryHigh, profile.poc, profile.valueAreaLow, profile.valueAreaHigh);
  if (!validReclaimGeometry(side, entryLow, entryHigh, stop, target)) return null;
  return { entryLow, entryHigh, stop, target };
}

function breakoutLevels(read: LiveReaderRead, side: Side, zoneHalfWidth: number): PlanLevels | null {
  const level = read.auction.level;
  const profile = read.auction.profile;
  const lastPrice = read.orderflow.lastPrice;
  if (!level || !profile || lastPrice === null) return null;

  if (side === "long") {
    const entryLow = level.price;
    const entryHigh = Math.max(lastPrice, level.price + zoneHalfWidth);
    const stop = level.price - zoneHalfWidth;
    const target = nextHigherStructure(lastPrice, profile.valueAreaHigh, profile.high);
    if (target === null || !validTarget(side, lastPrice, stop, target)) return null;
    return { entryLow, entryHigh, stop, target };
  }

  const entryLow = Math.min(lastPrice, level.price - zoneHalfWidth);
  const entryHigh = level.price;
  const stop = level.price + zoneHalfWidth;
  const target = nextLowerStructure(lastPrice, profile.valueAreaLow, profile.low);
  if (target === null || !validTarget(side, lastPrice, stop, target)) return null;
  return { entryLow, entryHigh, stop, target };
}

function targetFor(side: Side, entryLow: number, entryHigh: number, poc: number, valueAreaLow: number, valueAreaHigh: number): number {
  if (side === "long") return poc > entryHigh ? poc : valueAreaHigh;
  return poc < entryLow ? poc : valueAreaLow;
}

function nextHigherStructure(lastPrice: number, ...levels: number[]): number | null {
  return levels.filter((level) => Number.isFinite(level) && level > lastPrice).sort((a, b) => a - b)[0] ?? null;
}

function nextLowerStructure(lastPrice: number, ...levels: number[]): number | null {
  return levels.filter((level) => Number.isFinite(level) && level < lastPrice).sort((a, b) => b - a)[0] ?? null;
}

function validTarget(side: Side, entryPrice: number, stop: number, target: number): boolean {
  if (!Number.isFinite(entryPrice) || !Number.isFinite(stop) || !Number.isFinite(target)) return false;
  if (side === "long") return stop < entryPrice && entryPrice < target;
  return target < entryPrice && entryPrice < stop;
}

function validReclaimGeometry(side: Side, entryLow: number, entryHigh: number, stop: number, target: number): boolean {
  if (![entryLow, entryHigh, stop, target].every(Number.isFinite)) return false;
  if (side === "long") return stop < entryLow && entryHigh < target;
  return target < entryLow && entryHigh < stop;
}

function reclaimed(read: LiveReaderRead, side: Side): boolean {
  const level = read.auction.level;
  const lastPrice = read.orderflow.lastPrice;
  if (!level || lastPrice === null) return false;
  if (side === "long") return lastPrice >= level.price;
  return lastPrice <= level.price;
}

function narrativeSide(narrative: ReaderNarrative): Side | null {
  return narrative.direction === "long" || narrative.direction === "short" ? narrative.direction : null;
}

function familyFor(narrative: ReaderNarrative): ReaderSetupFamily {
  return narrative.intent === "breakout-watch" || narrative.intent === "breakout-continuation"
    ? "breakout-acceptance"
    : "reversal-reclaim";
}

function reasonsFor(read: LiveReaderRead, narrative: ReaderNarrative, setupFamily: ReaderSetupFamily): string[] {
  return dedupe([
    `narrative intent is ${narrative.intent}`,
    `participation is ${narrative.participation}`,
    `level story is ${narrative.levelStory}`,
    `${setupFamily} allowed by narrative`,
    ...narrative.reasons,
    read.orderflow.narrative,
  ]);
}

function invalidationFor(side: Side, stop: number): string {
  if (side === "long") return `Long plan is invalid below ${stop.toFixed(2)}.`;
  return `Short plan is invalid above ${stop.toFixed(2)}.`;
}

function noTrade(read: LiveReaderRead, reasons: string[], setupFamily: ReaderSetupFamily = "none"): ReaderTradePlan {
  const narrative = narrativeFor(read);
  return {
    status: "no-trade",
    asset: read.asset,
    setupFamily,
    regime: regimeFor(read),
    confidence: 0,
    narrative,
    reasons: dedupe(reasons),
  };
}

function narrativeFor(read: LiveReaderRead): ReaderNarrative {
  return read.narrativeRead ?? readReaderNarrative({
    auction: read.auction,
    orderflow: read.orderflow,
    lastClosedCandle: read.lastClosedCandle ?? null,
  });
}

function regimeFor(read: LiveReaderRead): ReaderMarketRegime {
  return read.regime ?? {
    mode: "unknown",
    highVol: false,
    rangePct: 0,
    driftPct: 0,
    directionalEfficiency: 0,
    reason: "reader did not provide regime context",
  };
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
