import { hyperliquidInfoUrl } from "./hyperliquid-info-url";
import type { CandleInterval, HyperliquidCandle, HyperliquidNetwork } from "../shared/types";
import { validateHyperliquidCandles } from "./validate-hyperliquid-candles";

export async function fetchHyperliquidCandles(input: {
  network: HyperliquidNetwork;
  asset: string;
  interval: CandleInterval;
  startMs: number;
  endMs: number;
}): Promise<HyperliquidCandle[]> {
  const res = await fetch(hyperliquidInfoUrl(input.network), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "candleSnapshot",
      req: {
        coin: input.asset.toUpperCase(),
        interval: input.interval,
        startTime: input.startMs,
        endTime: input.endMs,
      },
    }),
  });
  if (!res.ok) throw new Error(`Hyperliquid ${input.network} ${res.status}: ${await res.text()}`);
  return validateHyperliquidCandles(await res.json());
}
