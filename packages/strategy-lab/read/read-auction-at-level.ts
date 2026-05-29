import type { Candle } from "../types";
import type { OrderflowTrade } from "../orderflow/types";
import { buildLocalVolumeProfile } from "./build-local-volume-profile";
import { buildTradeVolumeProfile } from "./build-trade-volume-profile";
import { readAuctionAtPrice } from "./read-auction-at-price";
import type { AuctionRead, PriceLevel } from "./types";

export function readAuctionAtLevel(input: {
  asset: string;
  interval: string;
  candles: Candle[];
  level: PriceLevel | null;
  profileCandles: number;
  radiusPct: number;
  binCount: number;
  profileTrades?: OrderflowTrade[];
  price?: number;
}): AuctionRead {
  const last = input.candles[input.candles.length - 1];
  if (!last || !input.level) {
    return {
      asset: input.asset,
      interval: input.interval,
      level: input.level,
      profile: null,
      location: "outside-profile",
      bias: "wait",
      narrative: "No nearby level is active, so the reader waits.",
      invalidation: null,
      target: null,
    };
  }

  const profileWindow = input.candles.slice(Math.max(0, input.candles.length - input.profileCandles));
  const profile = input.profileTrades && input.profileTrades.length > 0 ? buildTradeVolumeProfile({
    trades: input.profileTrades,
    anchorPrice: input.level.price,
    radiusPct: input.radiusPct,
    binCount: input.binCount,
  }) : buildLocalVolumeProfile({
    candles: profileWindow,
    anchorPrice: input.level.price,
    radiusPct: input.radiusPct,
    binCount: input.binCount,
  });
  if (!profile) {
    return {
      asset: input.asset,
      interval: input.interval,
      level: input.level,
      profile: null,
      location: "outside-profile",
      bias: "wait",
      narrative: "The local profile has no usable volume around the selected level.",
      invalidation: null,
      target: null,
    };
  }

  return readAuctionAtPrice({
    asset: input.asset,
    interval: input.interval,
    level: input.level,
    profile,
    price: input.price ?? last.c,
  });
}
