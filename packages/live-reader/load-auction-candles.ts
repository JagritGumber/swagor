import { readVmCandles, type CandleInterval, type HyperliquidNetwork } from "../market-data";
import type { Candle } from "../strategy-lab";

export async function loadAuctionCandles(input: {
  vmUrl: string;
  network: HyperliquidNetwork;
  asset: string;
  interval: CandleInterval;
  days: number;
}): Promise<Candle[]> {
  const endMs = Date.now();
  const startMs = endMs - input.days * 86_400_000;
  return readVmCandles({
    vmUrl: input.vmUrl,
    network: input.network,
    asset: input.asset,
    interval: input.interval,
    startMs,
    endMs,
  });
}


