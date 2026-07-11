import { classifyAuctionLocation } from "./classify-auction-location";
import type { AuctionRead, LocalVolumeProfile, PriceLevel } from "./types";

export function readAuctionAtPrice(input: {
  asset: string;
  interval: string;
  level: PriceLevel | null;
  profile: LocalVolumeProfile | null;
  price: number;
}): AuctionRead {
  if (!input.level || !input.profile) {
    return {
      asset: input.asset,
      interval: input.interval,
      level: input.level,
      profile: input.profile,
      location: "outside-profile",
      bias: "wait",
      narrative: "No nearby level is active, so the reader waits.",
      invalidation: null,
      target: null,
    };
  }

  const location = classifyAuctionLocation({ price: input.price, profile: input.profile });
  const bias = readBias(input.level.kind, location);
  return {
    asset: input.asset,
    interval: input.interval,
    level: input.level,
    profile: input.profile,
    location,
    bias,
    narrative: narrative(input.asset, input.level.kind, location, input.price, input.profile.poc),
    invalidation: invalidation(input.level.kind, bias, input.profile),
    target: target(bias, input.profile),
  };
}

function readBias(kind: PriceLevel["kind"], location: AuctionRead["location"]): AuctionRead["bias"] {
  if (kind === "support" && location === "value-low") return "long";
  if (kind === "resistance" && location === "value-high") return "short";
  return "wait";
}

function narrative(_asset: string, kind: PriceLevel["kind"], location: AuctionRead["location"], _price: number, _poc: number): string {
  if (location === "near-poc") return `Price is balanced in the value area.`;
  if (kind === "support" && (location === "value-low" || location === "below-value")) {
    return `Price is near support at the value area low.`;
  }
  if (kind === "resistance" && (location === "value-high" || location === "above-value")) {
    return `Price is near resistance at the value area high.`;
  }
  return `Price is near a ${kind} level.`;
}

function invalidation(kind: PriceLevel["kind"], bias: AuctionRead["bias"], _profile: LocalVolumeProfile): string | null {
  if (bias === "long") return `A close below the value area low would invalidate the long read.`
  if (bias === "short") return `A close above the value area high would invalidate the short read.`
  if (kind === "support") return `Support is invalid if price closes below the value area low.`
  return `Resistance is invalid if price closes above the value area high.`
}

function target(bias: AuctionRead["bias"], profile: LocalVolumeProfile): string | null {
  if (bias === "long" || bias === "short") return `First target is rotation to POC ${profile.poc.toFixed(2)}.`;
  return null;
}

