import type { ReaderMarketRegime } from "../../read-core/market-regime/types";
import { readReaderNarrative } from "../../reader-narrative/read-reader-narrative";
import type { ReaderNarrative } from "../../reader-narrative/types";
import type { Side } from "../../types";
import type { LiveReaderRead } from "../../reader-live/types";
import { readReaderVpPlaybook } from "../../reader-vp-playbook/read-reader-vp-playbook";
import type { ReaderActionableTradePlan, ReaderSetupFamily, ReaderTradePlan, ReaderTradePlanConfig } from "./types";

export function buildReaderTradePlan(read: LiveReaderRead, _config: ReaderTradePlanConfig = {}): ReaderTradePlan {
  const narrative = narrativeFor(read);
  const reasons = baseNoTradeReasons(read, narrative);
  if (reasons.length > 0) return noTrade(read, reasons);

  const styleBlock = tradeStyleBlock(read, narrative, _config.tradeStyle ?? "all");
  if (styleBlock.length > 0) return noTrade(read, styleBlock, familyFor(narrative));

  const continuationBlock = continuationPullbackBlock(read, narrative);
  if (continuationBlock.length > 0) return noTrade(read, continuationBlock, familyFor(narrative));

  if (narrative.intent === "breakout-watch" || narrative.intent === "reversal-watch") {
    return watchPlan(read, narrative);
  }
  if (narrative.intent === "breakout-continuation" || narrative.intent === "trend-continuation") {
    return readyPlan(read, narrative, narrative.intent === "trend-continuation" ? "trend-continuation" : "breakout-acceptance");
  }
  if (narrative.intent === "reversal-reclaim") {
    return reclaimPlan(read, narrative);
  }
  if (narrative.intent === "continuation-pullback") {
    return readyPlan(read, narrative, "trend-continuation");
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
  const modeBlock = auctionModeBlock(read, side, narrative, familyFor(narrative));
  if (modeBlock.length > 0) return noTrade(read, modeBlock, familyFor(narrative));
  const levels = planLevels(read, side, narrative, familyFor(narrative));
  if (!levels) return noTrade(read, ["narrative is watchable but numeric auction levels are incomplete"], familyFor(narrative));
  const targetBlock = auctionModeTargetBlock(read, side, levels);
  if (targetBlock.length > 0) return noTrade(read, targetBlock, familyFor(narrative));
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
  const modeBlock = auctionModeBlock(read, side, narrative, "reversal-reclaim");
  if (modeBlock.length > 0) return noTrade(read, modeBlock, "reversal-reclaim");
  const vpBlock = vpPlaybookBlock(read, narrative, side, "reversal-reclaim");
  if (vpBlock.length > 0) return noTrade(read, vpBlock, "reversal-reclaim");
  const levels = planLevels(read, side, narrative, "reversal-reclaim");
  if (!levels) return noTrade(read, ["narrative allows reclaim but numeric auction levels are incomplete"], "reversal-reclaim");
  const targetBlock = auctionModeTargetBlock(read, side, levels);
  if (targetBlock.length > 0) return noTrade(read, targetBlock, "reversal-reclaim");
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
  const modeBlock = auctionModeBlock(read, side, narrative, setupFamily);
  if (modeBlock.length > 0) return noTrade(read, modeBlock, setupFamily);
  const vpBlock = vpPlaybookBlock(read, narrative, side, setupFamily);
  if (vpBlock.length > 0) return noTrade(read, vpBlock, setupFamily);
  const levels = planLevels(read, side, narrative, setupFamily);
  if (!levels) return noTrade(read, ["narrative allows continuation but numeric auction levels are incomplete"], setupFamily);
  const targetBlock = auctionModeTargetBlock(read, side, levels);
  if (targetBlock.length > 0) return noTrade(read, targetBlock, setupFamily);
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

function planLevels(
  read: LiveReaderRead,
  side: Side,
  narrative: ReaderNarrative,
  setupFamily: ReaderSetupFamily,
): PlanLevels | null {
  const level = read.auction.level;
  const profile = read.auction.profile;
  const lastPrice = read.orderflow.lastPrice;
  if (!level || !profile || lastPrice === null) return null;

  const zoneHalfWidth = profile.binSize / 2;
  if (!Number.isFinite(zoneHalfWidth) || zoneHalfWidth <= 0) return null;

  if (setupFamily === "trend-continuation") {
    return trendContinuationLevels(read, side, zoneHalfWidth);
  }

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

function auctionModeBlock(
  read: LiveReaderRead,
  side: Side,
  narrative: ReaderNarrative,
  setupFamily: ReaderSetupFamily,
): string[] {
  const auctionMode = read.auctionMode;
  if (!auctionMode) return [];
  if (auctionMode.mode === "violent-unknown") return modeReasons(read, "violent auction mode blocks ready entries");
  if (auctionMode.allowedDirection !== "both" && auctionMode.allowedDirection !== side) {
    return modeReasons(read, `${auctionMode.mode} does not allow ${side} plans`);
  }
  const failedExpansionChase = setupFamily === "breakout-acceptance"
    || (setupFamily === "trend-continuation" && narrative.intent === "trend-continuation");
  if (auctionMode.mode === "failed-expansion" && failedExpansionChase) {
    return modeReasons(read, "failed expansion blocks breakout chasing");
  }
  return [];
}

function auctionModeTargetBlock(read: LiveReaderRead, side: Side, levels: PlanLevels): string[] {
  const auctionMode = read.auctionMode;
  if (!auctionMode || (auctionMode.mode !== "balanced-value" && auctionMode.mode !== "poc-gravity" && auctionMode.mode !== "failed-expansion")) return [];
  if (targetMovesTowardPoc(read, side, levels)) return [];
  return modeReasons(read, `${auctionMode.mode} only allows edge-to-POC rotations`);
}

function vpPlaybookBlock(
  read: LiveReaderRead,
  narrative: ReaderNarrative,
  side: Side,
  setupFamily: ReaderSetupFamily,
): string[] {
  const playbook = readReaderVpPlaybook(read, narrative);
  if (playbook.kind === "no-trade") {
    return playbook.reason === "VP does not provide a clean fade or continuation playbook"
      ? []
      : [`VP blocks trade: ${playbook.reason}`];
  }
  if (playbook.allowedSide !== side) return [`VP allows ${playbook.allowedSide}, not ${side}: ${playbook.reason}`];
  if ((setupFamily === "breakout-acceptance" || setupFamily === "trend-continuation") && playbook.kind !== "accepted-continuation") {
    return [`VP blocks breakout plan: ${playbook.reason}`];
  }
  if (setupFamily === "reversal-reclaim" && playbook.kind === "accepted-continuation") {
    return [`VP blocks fade against accepted continuation: ${playbook.reason}`];
  }
  return [];
}

function targetMovesTowardPoc(read: LiveReaderRead, side: Side, levels: PlanLevels): boolean {
  const profile = read.auction.profile;
  if (!profile) return false;
  const tolerance = profile.binSize / 2;
  if (!Number.isFinite(tolerance) || tolerance <= 0) return false;
  if (side === "long") {
    return profile.poc > levels.entryHigh && Math.abs(levels.target - profile.poc) <= tolerance;
  }
  return profile.poc < levels.entryLow && Math.abs(levels.target - profile.poc) <= tolerance;
}

function modeReasons(read: LiveReaderRead, reason: string): string[] {
  return dedupe([reason, ...(read.auctionMode?.reasons ?? [])]);
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

function trendContinuationLevels(read: LiveReaderRead, side: Side, zoneHalfWidth: number): PlanLevels | null {
  const level = read.auction.level;
  const profile = read.auction.profile;
  const lastPrice = read.orderflow.lastPrice;
  if (!level || !profile || lastPrice === null) return null;

  if (side === "long") {
    const stop = level.price - zoneHalfWidth;
    const target = nextHigherStructure(lastPrice, profile.valueAreaHigh, profile.high);
    if (target === null || !validTarget(side, lastPrice, stop, target)) return null;
    return {
      entryLow: Math.min(lastPrice, level.price),
      entryHigh: Math.max(lastPrice, level.price + zoneHalfWidth),
      stop,
      target,
    };
  }

  const stop = level.price + zoneHalfWidth;
  const target = nextLowerStructure(lastPrice, profile.valueAreaLow, profile.low);
  if (target === null || !validTarget(side, lastPrice, stop, target)) return null;
  return {
    entryLow: Math.min(lastPrice, level.price - zoneHalfWidth),
    entryHigh: Math.max(lastPrice, level.price),
    stop,
    target,
  };
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
  if (narrative.intent === "breakout-watch" || narrative.intent === "breakout-continuation") return "breakout-acceptance";
  if (narrative.intent === "trend-continuation" || narrative.intent === "continuation-pullback") return "trend-continuation";
  return "reversal-reclaim";
}

function tradeStyleBlock(read: LiveReaderRead, narrative: ReaderNarrative, style: NonNullable<ReaderTradePlanConfig["tradeStyle"]>): string[] {
  if (style === "all") return [];
  const family = familyFor(narrative);
  if (style === "trend-only" && family !== "trend-continuation") {
    return [`trend-only experiment blocks ${family} setup`];
  }
  if (style === "trend-breakout-only" && narrative.intent !== "trend-continuation") {
    return [`trend-breakout-only experiment blocks ${narrative.intent} setup`];
  }
  if (style === "trend-pullback-only" && narrative.intent !== "continuation-pullback") {
    return [`trend-pullback-only experiment blocks ${narrative.intent} setup`];
  }
  if (style === "trend-long-pullback-only" && (narrative.intent !== "continuation-pullback" || narrative.direction !== "long")) {
    return [`trend-long-pullback-only experiment blocks ${narrative.intent}/${narrative.direction} setup`];
  }
  if (style === "trend-short-pullback-only" && (narrative.intent !== "continuation-pullback" || narrative.direction !== "short")) {
    return [`trend-short-pullback-only experiment blocks ${narrative.intent}/${narrative.direction} setup`];
  }
  if (style === "reversal-only" && family === "trend-continuation") {
    return ["reversal-only experiment blocks trend-continuation setup"];
  }
  return [];
}

function continuationPullbackBlock(read: LiveReaderRead, narrative: ReaderNarrative): string[] {
  if (narrative.intent !== "continuation-pullback") return [];
  const edgeMismatch = continuationPullbackEdgeMismatch(read, narrative);
  if (edgeMismatch.length > 0) return edgeMismatch;
  const initiativeFailure = continuationInitiativeFailure(read, narrative);
  if (initiativeFailure.length > 0) return initiativeFailure;
  if (narrative.participation !== "absorption") return [];
  return [
    "continuation pullback is blocked because absorption is not initiative continuation by itself",
    "absorption must resolve into initiative participation before trend continuation entry",
  ];
}

function continuationPullbackEdgeMismatch(read: LiveReaderRead, narrative: ReaderNarrative): string[] {
  if (narrative.direction === "long" && (read.auction.location !== "value-low" || read.auction.level?.kind !== "support")) {
    return [
      "continuation pullback is blocked because long pullback is not at value-low support",
      "below-value acceptance is not a long pullback into value support",
    ];
  }
  if (narrative.direction === "short" && (read.auction.location !== "value-high" || read.auction.level?.kind !== "resistance")) {
    return [
      "continuation pullback is blocked because short pullback is not at value-high resistance",
      "above-value acceptance is not a short pullback into value resistance",
    ];
  }
  return [];
}

function continuationInitiativeFailure(read: LiveReaderRead, narrative: ReaderNarrative): string[] {
  if (narrative.direction === "long" && initiativeSideIsAbsorbed(read, "long")) {
    return [
      "continuation pullback is blocked because buying initiative is being absorbed",
      "a long pullback needs initiative buying, not stalled buying into absorption",
    ];
  }
  if (narrative.direction === "short" && initiativeSideIsAbsorbed(read, "short")) {
    return [
      "continuation pullback is blocked because selling initiative is being absorbed",
      "a short pullback needs initiative selling, not stalled selling into absorption",
    ];
  }
  if (read.absorptionQuality?.quality === "churn") {
    return [
      "continuation pullback is blocked because absorption is reading as churn",
      "churn means the reader has no clean initiative continuation",
    ];
  }
  return [];
}

function initiativeSideIsAbsorbed(read: LiveReaderRead, side: Side): boolean {
  const events = new Set(read.orderflow.events);
  if (side === "long") return events.has("buy-absorption") || events.has("stalled-buying");
  return events.has("sell-absorption") || events.has("stalled-selling");
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
