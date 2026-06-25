import type { AuctionRead } from "../../read-core/read/types";
import type { OrderflowRead } from "../../read-core/orderflow/types";
import type {
  ReaderVpAuctionState,
  ReaderVpPocState,
  ReaderVpState,
  ReaderVpStateMemory,
  ReaderVpValueState,
} from "./types";

export function readReaderVpState(input: {
  auction: AuctionRead;
  orderflow: OrderflowRead;
  memory?: ReaderVpStateMemory | null;
}): ReaderVpState {
  const previousProfile = input.memory?.previousProfile ?? null;
  const previousLocation = input.memory?.previousLocation ?? null;
  const profile = input.auction.profile;

  const poc = pocState(input.auction, previousProfile);
  const value = valueState(input.auction, previousProfile);
  const auction = auctionState({
    auction: input.auction,
    orderflow: input.orderflow,
    previousLocation,
    poc,
    value,
  });
  const state = {
    poc,
    value,
    auction,
    reasons: reasonsFor({ poc, value, auction }),
  };

  if (input.memory) {
    input.memory.previousProfile = profile;
    input.memory.previousLocation = input.auction.location;
    input.memory.previousAuction = auction;
  }

  return state;
}

function pocState(auction: AuctionRead, previousProfile: AuctionRead["profile"] | null): ReaderVpPocState {
  if (!auction.profile || !previousProfile) return "unknown";
  const tolerance = auction.profile.binSize / 2;
  const delta = auction.profile.poc - previousProfile.poc;
  if (Math.abs(delta) <= tolerance) return "poc-stable";
  return delta > 0 ? "poc-migrating-up" : "poc-migrating-down";
}

function valueState(auction: AuctionRead, previousProfile: AuctionRead["profile"] | null): ReaderVpValueState {
  if (!auction.profile || !previousProfile) return "unknown";
  const tolerance = auction.profile.binSize / 2;
  const lowDelta = auction.profile.valueAreaLow - previousProfile.valueAreaLow;
  const highDelta = auction.profile.valueAreaHigh - previousProfile.valueAreaHigh;
  const lowMovedUp = lowDelta > tolerance;
  const lowMovedDown = lowDelta < -tolerance;
  const highMovedUp = highDelta > tolerance;
  const highMovedDown = highDelta < -tolerance;

  if (lowMovedUp && highMovedUp) return "value-expanding-up";
  if (lowMovedDown && highMovedDown) return "value-expanding-down";
  if (lowMovedUp && highMovedDown) return "value-compressing";
  return "value-stable";
}

function auctionState(input: {
  auction: AuctionRead;
  orderflow: OrderflowRead;
  previousLocation: AuctionRead["location"] | null;
  poc: ReaderVpPocState;
  value: ReaderVpValueState;
}): ReaderVpAuctionState {
  if (!input.auction.profile) return "unknown";
  if (input.auction.location === "near-poc") {
    return edgeOrOutside(input.previousLocation) ? "poc-chop" : "inside-value";
  }
  if (
    input.auction.location === "above-value"
    && input.orderflow.pressure === "buy-pressure"
    && (input.poc === "poc-migrating-up" || input.value === "value-expanding-up")
  ) {
    return "accepting-above-value";
  }
  if (
    input.auction.location === "below-value"
    && input.orderflow.pressure === "sell-pressure"
    && (input.poc === "poc-migrating-down" || input.value === "value-expanding-down")
  ) {
    return "accepting-below-value";
  }
  if (
    input.auction.location === "value-high"
    && input.orderflow.events.includes("buy-absorption")
    && input.poc !== "poc-migrating-up"
    && input.value !== "value-expanding-up"
  ) {
    return "rejecting-above-value";
  }
  if (
    input.auction.location === "value-low"
    && input.orderflow.events.includes("sell-absorption")
    && input.poc !== "poc-migrating-down"
    && input.value !== "value-expanding-down"
  ) {
    return "rejecting-below-value";
  }
  if (insideValue(input.auction.location)) return "inside-value";
  return "unknown";
}

function reasonsFor(input: {
  poc: ReaderVpPocState;
  value: ReaderVpValueState;
  auction: ReaderVpAuctionState;
}): string[] {
  return [
    `VP POC is ${input.poc}`,
    `VP value is ${input.value}`,
    `VP auction is ${input.auction}`,
  ];
}

function insideValue(location: AuctionRead["location"]): boolean {
  return location === "near-poc" || location === "value-low" || location === "value-high";
}

function edgeOrOutside(location: AuctionRead["location"] | null): boolean {
  return location === "value-low"
    || location === "value-high"
    || location === "above-value"
    || location === "below-value"
    || location === "outside-profile";
}


