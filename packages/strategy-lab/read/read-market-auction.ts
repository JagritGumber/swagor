import type { Candle } from "../types";
import { clusterPriceLevels } from "./cluster-price-levels";
import { findSwingHighs } from "./find-swing-highs";
import { findSwingLows } from "./find-swing-lows";
import { nearestPriceLevel } from "./nearest-price-level";
import { readAuctionAtLevel } from "./read-auction-at-level";
import type { AuctionRead } from "./types";

export function readMarketAuction(input: {
  asset: string;
  interval: string;
  candles: Candle[];
  swingLeft?: number;
  swingRight?: number;
  levelTolerancePct?: number;
  levelMinTouches?: number;
  maxLevelDistancePct?: number;
  profileCandles?: number;
  profileRadiusPct?: number;
  profileBins?: number;
}): AuctionRead {
  const last = input.candles[input.candles.length - 1];
  if (!last) {
    return {
      asset: input.asset,
      interval: input.interval,
      level: null,
      profile: null,
      location: "outside-profile",
      bias: "wait",
      narrative: "No candles are available for the reader.",
      invalidation: null,
      target: null,
    };
  }

  const swingLeft = input.swingLeft ?? 3;
  const swingRight = input.swingRight ?? 3;
  const supports = findSwingLows({ candles: input.candles, left: swingLeft, right: swingRight });
  const resistances = findSwingHighs({ candles: input.candles, left: swingLeft, right: swingRight });
  const levels = clusterPriceLevels({
    supports,
    resistances,
    tolerancePct: input.levelTolerancePct ?? 0.003,
    minTouches: input.levelMinTouches ?? 2,
  });
  const level = nearestPriceLevel({
    levels,
    price: last.c,
    maxDistancePct: input.maxLevelDistancePct ?? 0.012,
  });

  return readAuctionAtLevel({
    asset: input.asset,
    interval: input.interval,
    candles: input.candles,
    level,
    profileCandles: input.profileCandles ?? 120,
    radiusPct: input.profileRadiusPct ?? 0.015,
    binCount: input.profileBins ?? 24,
  });
}
