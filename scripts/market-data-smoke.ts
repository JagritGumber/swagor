import { buildVmCandleLines, normalizeHyperliquidCandle } from "../packages/market-data/src";
import type { HyperliquidCandle } from "../packages/market-data/src";

const raw: HyperliquidCandle = {
  t: 1_700_000_000_000,
  T: 1_700_000_299_999,
  s: "BTC",
  i: "5m",
  o: "100",
  h: "105",
  l: "99",
  c: "103",
  v: "42.5",
  n: 12,
};

const candle = normalizeHyperliquidCandle(raw);
const lines = buildVmCandleLines({
  network: "mainnet",
  asset: "BTC",
  interval: "5m",
  candles: [candle],
});

if (!lines.includes('market_candle_open{venue="hyperliquid",network="mainnet",asset="BTC",interval="5m"} 100 1700000000000')) {
  throw new Error("open line missing");
}
if (!lines.includes("market_candle_volume")) throw new Error("volume line missing");

console.log("market-data-smoke ok");
