import type { CandleInterval, HyperliquidNetwork } from "../market-data";
import { readMarketAuction, type AuctionRead } from "../strategy-lab";
import { loadAuctionCandles } from "./load-auction-candles";

export async function loadAuctionRead(input: {
  vmUrl: string;
  network: HyperliquidNetwork;
  asset: string;
  interval: CandleInterval;
  days: number;
}): Promise<AuctionRead> {
  const candles = await loadAuctionCandles(input);
  return readMarketAuction({ asset: input.asset, interval: input.interval, candles });
}

