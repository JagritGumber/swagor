import type { LiveReaderRead } from "../reader-live/types";
import type { Side } from "../types";
import { readerRejectionEdgeFor } from "../reader-live/reader-rejection-edge-for";
import type { ReaderActionableTradePlan, ReaderTradePlan, ReaderTradePlanConfig } from "./types";

const DEFAULT_CONFIG = {
  entryZoneMinPct: 0.0005,
  watchConfidence: 0.55,
  readyConfidence: 0.72,
  largePrintConfidenceBoost: 0.04,
  failedPressureConfidenceBoost: 0.08,
};

export function buildReaderTradePlan(read: LiveReaderRead, config: ReaderTradePlanConfig = {}): ReaderTradePlan {
  const cfg = resolveConfig(config);
  const reasons = baseNoTradeReasons(read);
  if (reasons.length > 0) return noTrade(read.asset, reasons);

  const side = readerRejectionEdgeFor(read.auction)?.side ?? null;
  if (!side) return noTrade(read.asset, ["auction location is not a strict rejection edge"]);

  const ready = isReady(read, side);
  const watch = isWatch(read, side);
  if (!ready && !watch) return noTrade(read.asset, [`orderflow is not pressing into ${side} rejection yet`]);

  const levels = planLevels(read, side, cfg.entryZoneMinPct);
  if (!levels) return noTrade(read.asset, ["reader could not build numeric plan levels"]);
  const status = ready ? readinessStatus(side, read.orderflow.lastPrice, levels.entryLow, levels.entryHigh) : "watch";
  return actionablePlan({
    read,
    side,
    status,
    confidence: confidenceFor(read, status, cfg),
    levels,
  });
}

function resolveConfig(config: ReaderTradePlanConfig): Required<ReaderTradePlanConfig> {
  return {
    entryZoneMinPct: config.entryZoneMinPct ?? DEFAULT_CONFIG.entryZoneMinPct,
    watchConfidence: config.watchConfidence ?? DEFAULT_CONFIG.watchConfidence,
    readyConfidence: config.readyConfidence ?? DEFAULT_CONFIG.readyConfidence,
    largePrintConfidenceBoost: config.largePrintConfidenceBoost ?? DEFAULT_CONFIG.largePrintConfidenceBoost,
    failedPressureConfidenceBoost: config.failedPressureConfidenceBoost ?? DEFAULT_CONFIG.failedPressureConfidenceBoost,
  };
}

function baseNoTradeReasons(read: LiveReaderRead): string[] {
  const reasons: string[] = [];
  if (!read.auction.level) reasons.push("auction has no active support/resistance level");
  if (!read.auction.profile) reasons.push("auction has no local volume profile");
  if (read.orderflow.lastPrice === null) reasons.push("orderflow has no last traded price");
  if (read.auction.location === "near-poc") reasons.push("price is near POC");
  if (read.auction.location === "outside-profile") reasons.push("price is outside the active profile");
  return reasons;
}

function isReady(read: LiveReaderRead, side: Side): boolean {
  if (side === "long") return read.stance === "possible-long" && read.orderflow.events.includes("stalled-selling");
  return read.stance === "possible-short" && read.orderflow.events.includes("stalled-buying");
}

function isWatch(read: LiveReaderRead, side: Side): boolean {
  if (side === "long") return read.orderflow.pressure === "sell-pressure" || read.stance === "watch-long-confirmation";
  return read.orderflow.pressure === "buy-pressure" || read.stance === "watch-short-confirmation";
}

function actionablePlan(input: {
  read: LiveReaderRead;
  side: Side;
  status: ReaderActionableTradePlan["status"];
  confidence: number;
  levels: PlanLevels;
}): ReaderActionableTradePlan {
  const level = input.read.auction.level;
  const profile = input.read.auction.profile;
  const lastPrice = input.read.orderflow.lastPrice;
  if (!level || !profile || lastPrice === null) {
    throw new Error("actionable reader trade plan requires level, profile, and last price");
  }

  return {
    status: input.status,
    asset: input.read.asset,
    side: input.side,
    entryLow: input.levels.entryLow,
    entryHigh: input.levels.entryHigh,
    stop: input.levels.stop,
    target: input.levels.target,
    invalidation: input.read.invalidation ?? invalidationFor(input.side, input.levels.stop),
    confidence: input.confidence,
    reasons: reasonsFor(input.read, input.side, input.status),
  };
}

type PlanLevels = {
  entryLow: number;
  entryHigh: number;
  stop: number;
  target: number;
};

function planLevels(read: LiveReaderRead, side: Side, entryZoneMinPct: number): PlanLevels | null {
  const level = read.auction.level;
  const profile = read.auction.profile;
  const lastPrice = read.orderflow.lastPrice;
  if (!level || !profile || lastPrice === null) return null;
  const zoneHalfWidth = Math.max(profile.binSize / 2, lastPrice * entryZoneMinPct);
  const entryLow = level.price - zoneHalfWidth;
  const entryHigh = level.price + zoneHalfWidth;
  const stop = side === "long" ? entryLow - zoneHalfWidth : entryHigh + zoneHalfWidth;
  const target = targetFor(side, entryLow, entryHigh, profile.poc, profile.valueAreaLow, profile.valueAreaHigh);
  return { entryLow, entryHigh, stop, target };
}

function readinessStatus(
  side: Side,
  lastPrice: number | null,
  entryLow: number,
  entryHigh: number,
): ReaderActionableTradePlan["status"] {
  if (lastPrice === null) return "watch";
  if (side === "long") return lastPrice >= entryLow ? "ready" : "ready-if-reclaim";
  return lastPrice <= entryHigh ? "ready" : "ready-if-reclaim";
}

function targetFor(side: Side, entryLow: number, entryHigh: number, poc: number, valueAreaLow: number, valueAreaHigh: number): number {
  if (side === "long") return poc > entryHigh ? poc : valueAreaHigh;
  return poc < entryLow ? poc : valueAreaLow;
}

function invalidationFor(side: Side, stop: number): string {
  if (side === "long") return `Long plan is invalid below ${stop.toFixed(2)}.`;
  return `Short plan is invalid above ${stop.toFixed(2)}.`;
}

function confidenceFor(
  read: LiveReaderRead,
  status: ReaderActionableTradePlan["status"],
  config: Required<ReaderTradePlanConfig>,
): number {
  let confidence = status === "watch" ? config.watchConfidence : config.readyConfidence;
  if (status === "ready-if-reclaim") confidence -= 0.06;
  if (read.orderflow.events.includes("large-print")) confidence += config.largePrintConfidenceBoost;
  if (read.orderflow.events.includes("stalled-buying") || read.orderflow.events.includes("stalled-selling")) {
    confidence += config.failedPressureConfidenceBoost;
  }
  return Math.min(0.9, Number(confidence.toFixed(4)));
}

function reasonsFor(
  read: LiveReaderRead,
  side: Side,
  status: ReaderActionableTradePlan["status"],
): string[] {
  const edge = side === "long" ? "support" : "resistance";
  const action = actionReason(status);
  return [
    `${read.auction.location} at ${edge}`,
    action,
    read.orderflow.narrative,
  ];
}

function actionReason(status: ReaderActionableTradePlan["status"]): string {
  if (status === "ready") return "failed pressure confirms rejection";
  if (status === "ready-if-reclaim") return "failed pressure is present but price still needs to reclaim the entry zone";
  return "waiting for failed pressure confirmation";
}

function noTrade(asset: string, reasons: string[]): ReaderTradePlan {
  return {
    status: "no-trade",
    asset,
    confidence: 0,
    reasons,
  };
}
