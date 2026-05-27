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

  return actionablePlan({
    read,
    side,
    status: ready ? "ready" : "watch",
    confidence: confidenceFor(read, ready, cfg),
    entryZoneMinPct: cfg.entryZoneMinPct,
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
  entryZoneMinPct: number;
}): ReaderActionableTradePlan {
  const level = input.read.auction.level;
  const profile = input.read.auction.profile;
  const lastPrice = input.read.orderflow.lastPrice;
  if (!level || !profile || lastPrice === null) {
    throw new Error("actionable reader trade plan requires level, profile, and last price");
  }

  const zoneHalfWidth = Math.max(profile.binSize / 2, lastPrice * input.entryZoneMinPct);
  const entryLow = level.price - zoneHalfWidth;
  const entryHigh = level.price + zoneHalfWidth;
  const stop = input.side === "long" ? entryLow - zoneHalfWidth : entryHigh + zoneHalfWidth;
  const target = targetFor(input.side, entryLow, entryHigh, profile.poc, profile.valueAreaLow, profile.valueAreaHigh);

  return {
    status: input.status,
    asset: input.read.asset,
    side: input.side,
    entryLow,
    entryHigh,
    stop,
    target,
    invalidation: input.read.invalidation ?? invalidationFor(input.side, stop),
    confidence: input.confidence,
    reasons: reasonsFor(input.read, input.side, input.status),
  };
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
  ready: boolean,
  config: Required<ReaderTradePlanConfig>,
): number {
  let confidence = ready ? config.readyConfidence : config.watchConfidence;
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
  const action = status === "ready" ? "failed pressure confirms rejection" : "waiting for failed pressure confirmation";
  return [
    `${read.auction.location} at ${edge}`,
    action,
    read.orderflow.narrative,
  ];
}

function noTrade(asset: string, reasons: string[]): ReaderTradePlan {
  return {
    status: "no-trade",
    asset,
    confidence: 0,
    reasons,
  };
}
