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

function narrative(asset: string, kind: PriceLevel["kind"], location: AuctionRead["location"], price: number, poc: number): string {
  if (location === "near-poc") return `${asset} is trading around local POC, so auction is balanced and the reader waits.`;
  if (kind === "support" && (location === "value-low" || location === "below-value")) {
    return `${asset} is testing support near local value low; long idea needs rejection or reclaim toward POC.`;
  }
  if (kind === "resistance" && (location === "value-high" || location === "above-value")) {
    return `${asset} is testing resistance near local value high; short idea needs rejection or failure back toward POC.`;
  }
  return `${asset} is near a ${kind} level but price ${price.toFixed(2)} is not at a clean auction edge versus POC ${poc.toFixed(2)}.`;
}

function invalidation(kind: PriceLevel["kind"], bias: AuctionRead["bias"], profile: LocalVolumeProfile): string | null {
  if (bias === "long") return `Acceptance below ${profile.valueAreaLow.toFixed(2)} invalidates the support read.`;
  if (bias === "short") return `Acceptance above ${profile.valueAreaHigh.toFixed(2)} invalidates the resistance read.`;
  if (kind === "support") return `Support read is invalid if price accepts below ${profile.valueAreaLow.toFixed(2)}.`;
  return `Resistance read is invalid if price accepts above ${profile.valueAreaHigh.toFixed(2)}.`;
}

function target(bias: AuctionRead["bias"], profile: LocalVolumeProfile): string | null {
  if (bias === "long" || bias === "short") return `First target is rotation to POC ${profile.poc.toFixed(2)}.`;
  return null;
}

