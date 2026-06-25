import { fetchHyperliquidCandlesPaginated } from "../hyperliquid/fetch-hyperliquid-candles-paginated";
import { normalizeHyperliquidCandle } from "../hyperliquid/normalize-hyperliquid-candle";
import type { CandleInterval, HyperliquidNetwork } from "../shared/types";
import { buildVmCandleLines } from "../victoria-metrics/build-vm-candle-lines";
import { writeVmLines } from "../victoria-metrics/write-vm-lines";

export async function ingestHyperliquidCandles(input: {
  vmUrl: string;
  network: HyperliquidNetwork;
  assets: string[];
  intervals: CandleInterval[];
  startMs: number;
  endMs: number;
}): Promise<Array<{ asset: string; interval: CandleInterval; candles: number }>> {
  const results: Array<{ asset: string; interval: CandleInterval; candles: number }> = [];
  for (const asset of input.assets) {
    for (const interval of input.intervals) {
      const raw = await fetchHyperliquidCandlesPaginated({
        network: input.network,
        asset,
        interval,
        startMs: input.startMs,
        endMs: input.endMs,
      });
      const candles = raw.map(normalizeHyperliquidCandle);
      for (let i = 0; i < candles.length; i += 2000) {
        await writeVmLines({
          vmUrl: input.vmUrl,
          lines: buildVmCandleLines({ network: input.network, asset, interval, candles: candles.slice(i, i + 2000) }),
        });
      }
      results.push({ asset: asset.toUpperCase(), interval, candles: candles.length });
    }
  }
  return results;
}

