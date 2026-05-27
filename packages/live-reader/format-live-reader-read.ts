import type { LiveReaderRead } from "../strategy-lab";

export function formatLiveReaderRead(read: LiveReaderRead): object {
  return {
    asset: read.asset,
    stance: read.stance,
    auction: {
      level: read.auction.level ? {
        kind: read.auction.level.kind,
        price: round(read.auction.level.price),
        touches: read.auction.level.touches,
      } : null,
      location: read.auction.location,
      bias: read.auction.bias,
      profile: read.auction.profile ? {
        poc: round(read.auction.profile.poc),
        valueAreaLow: round(read.auction.profile.valueAreaLow),
        valueAreaHigh: round(read.auction.profile.valueAreaHigh),
      } : null,
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

function round(value: number): number {
  return Number(value.toFixed(6));
}
