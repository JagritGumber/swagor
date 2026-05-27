import { readVmCandles, type CandleInterval, type HyperliquidNetwork } from "../market-data";
import { readMarketAuction, type AuctionRead } from "../strategy-lab";

export async function loadAuctionRead(input: {
  vmUrl: string;
  network: HyperliquidNetwork;
  asset: string;
  interval: CandleInterval;
  days: number;
}): Promise<AuctionRead> {
  const endMs = Date.now();
  const startMs = endMs - input.days * 86_400_000;
  const candles = await readVmCandles({
    vmUrl: input.vmUrl,
    network: input.network,
    asset: input.asset,
    interval: input.interval,
    startMs,
    endMs,
  });
  return readMarketAuction({ asset: input.asset, interval: input.interval, candles });
}
