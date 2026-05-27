import type { AuctionRead } from "../read/types";
import type { OrderflowRead } from "../orderflow/types";
import type { LiveReaderRead, LiveReaderStance } from "./types";

export function combineAuctionOrderflow(input: {
  auction: AuctionRead;
  orderflow: OrderflowRead;
}): LiveReaderRead {
  const stance = stanceFor(input.auction, input.orderflow);
  return {
    asset: input.auction.asset,
    auction: input.auction,
    orderflow: input.orderflow,
    stance,
    narrative: narrativeFor(input.auction, input.orderflow, stance),
    invalidation: input.auction.invalidation,
    target: input.auction.target,
  };
}

function stanceFor(auction: AuctionRead, orderflow: OrderflowRead): LiveReaderStance {
  if (!auction.level || !auction.profile) return "wait";
  if (auction.location === "near-poc") return "avoid-balanced-auction";
  if (auction.level.kind === "resistance" && orderflow.events.includes("stalled-buying")) return "possible-short";
  if (auction.level.kind === "support" && orderflow.events.includes("stalled-selling")) return "possible-long";
  if (auction.level.kind === "resistance" && orderflow.pressure === "buy-pressure") return "watch-short-confirmation";
  if (auction.level.kind === "support" && orderflow.pressure === "sell-pressure") return "watch-long-confirmation";
  if (auction.bias === "short") return "watch-short-confirmation";
  if (auction.bias === "long") return "watch-long-confirmation";
  return "wait";
}

function narrativeFor(auction: AuctionRead, orderflow: OrderflowRead, stance: LiveReaderStance): string {
  if (!auction.level || !auction.profile) return `${auction.asset} has no active level; live reader waits.`;
  const location = `${auction.level.kind} near ${auction.location}`;
  if (stance === "possible-short") {
    return `${auction.asset} is at ${location}. ${orderflow.narrative} Short idea is forming but still needs rejection confirmation.`;
  }
  if (stance === "possible-long") {
    return `${auction.asset} is at ${location}. ${orderflow.narrative} Long idea is forming but still needs reclaim confirmation.`;
  }
  if (stance === "watch-short-confirmation") {
    return `${auction.asset} is at ${location}. ${orderflow.narrative} Watch for buyers to fail before considering a short plan.`;
  }
  if (stance === "watch-long-confirmation") {
    return `${auction.asset} is at ${location}. ${orderflow.narrative} Watch for sellers to fail before considering a long plan.`;
  }
  if (stance === "avoid-balanced-auction") {
    return `${auction.asset} is trading around local POC; live orderflow is context, not a trade location.`;
  }
  return `${auction.asset} has auction context but orderflow is not confirming a useful read.`;
}
