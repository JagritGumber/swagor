import type { AuctionRead } from "../read/types";
import type { OrderflowRead } from "../orderflow/types";
import type { ReaderMarketRegime } from "../market-regime/types";
import { readReaderNarrative } from "../reader-narrative/read-reader-narrative";
import type { ReaderNarrative } from "../reader-narrative/types";
import type { Candle } from "../types";
import type { LiveReaderRead, LiveReaderStance } from "./types";

export function combineAuctionOrderflow(input: {
  auction: AuctionRead;
  orderflow: OrderflowRead;
  regime: ReaderMarketRegime;
  lastClosedCandle: Candle | null;
}): LiveReaderRead {
  const narrativeRead = readReaderNarrative(input);
  const stance = stanceFor(narrativeRead);
  return {
    asset: input.auction.asset,
    auction: input.auction,
    orderflow: input.orderflow,
    regime: input.regime,
    lastClosedCandle: input.lastClosedCandle,
    stance,
    narrativeRead,
    narrative: narrativeFor(input.auction.asset, narrativeRead),
    invalidation: narrativeRead.invalidation,
    target: narrativeRead.target,
  };
}

function stanceFor(narrative: ReaderNarrative): LiveReaderStance {
  if (narrative.intent === "wait") {
    return narrative.levelStory === "inside-value" ? "avoid-balanced-auction" : "wait";
  }
  if (narrative.direction === "long") {
    return narrative.intent === "reversal-reclaim" || narrative.intent === "breakout-continuation"
      ? "possible-long"
      : "watch-long-confirmation";
  }
  if (narrative.direction === "short") {
    return narrative.intent === "reversal-reclaim" || narrative.intent === "breakout-continuation"
      ? "possible-short"
      : "watch-short-confirmation";
  }
  return "wait";
}

function narrativeFor(asset: string, narrative: ReaderNarrative): string {
  return `${asset} narrative=${narrative.intent} direction=${narrative.direction} participation=${narrative.participation} level=${narrative.levelStory}. ${narrative.reasons.join(" ")}`;
}
