import type { LiveReaderRead, ReaderTradePlan } from "../strategy-lab";

export function formatLiveReaderRead(read: LiveReaderRead): object {
  return {
    asset: read.asset,
    stance: read.stance,
    auction: {
      level: formatAuctionLevel(read),
      location: read.auction.location,
      bias: read.auction.bias,
      profile: formatAuctionProfile(read),
    },
    orderflow: {
      lastPrice: read.orderflow.lastPrice,
      pressure: read.orderflow.pressure,
      delta: round(read.orderflow.delta),
      tradeCount: read.orderflow.tradeCount,
      events: read.orderflow.events,
    },
    narrative: read.narrative,
    invalidation: read.invalidation,
    target: read.target,
  };
}

function formatAuctionLevel(read: LiveReaderRead): object | null {
  if (!read.auction.level) return null;
  return {
    kind: read.auction.level.kind,
    price: round(read.auction.level.price),
    touches: read.auction.level.touches,
  };
}

function formatAuctionProfile(read: LiveReaderRead): object | null {
  if (!read.auction.profile) return null;
  return {
    poc: round(read.auction.profile.poc),
    valueAreaLow: round(read.auction.profile.valueAreaLow),
    valueAreaHigh: round(read.auction.profile.valueAreaHigh),
  };
}

function round(value: number): number {
  return Number(value.toFixed(6));
}

export function formatReaderTradePlan(plan: ReaderTradePlan): object {
  if (plan.status === "no-trade") {
    return {
      status: plan.status,
      asset: plan.asset,
      confidence: plan.confidence,
      reasons: plan.reasons,
    };
  }
  return {
    status: plan.status,
    asset: plan.asset,
    side: plan.side,
    entryLow: round(plan.entryLow),
    entryHigh: round(plan.entryHigh),
    stop: round(plan.stop),
    target: round(plan.target),
    invalidation: plan.invalidation,
    confidence: plan.confidence,
    reasons: plan.reasons,
  };
}
