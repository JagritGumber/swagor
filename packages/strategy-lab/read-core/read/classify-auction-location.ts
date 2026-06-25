import type { LocalVolumeProfile, AuctionLocation } from "./types";

export function classifyAuctionLocation(input: {
  price: number;
  profile: LocalVolumeProfile;
}): AuctionLocation {
  const halfBin = input.profile.binSize / 2;
  if (input.price < input.profile.low || input.price > input.profile.high) return "outside-profile";
  if (Math.abs(input.price - input.profile.poc) <= halfBin) return "near-poc";
  if (input.price < input.profile.valueAreaLow) return "below-value";
  if (input.price <= input.profile.valueAreaLow + input.profile.binSize) return "value-low";
  if (input.price > input.profile.valueAreaHigh) return "above-value";
  if (input.price >= input.profile.valueAreaHigh - input.profile.binSize) return "value-high";
  return "near-poc";
}

