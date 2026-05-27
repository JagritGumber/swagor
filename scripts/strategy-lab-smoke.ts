import { runBacktest, starterStrategies, type Candle } from "../packages/strategy-lab";

function syntheticCandles(count: number): Candle[] {
  const candles: Candle[] = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    const drift = i > 80 && i < 130 ? 0.22 : i > 160 ? -0.08 : 0.03;
    const wave = Math.sin(i / 6) * 0.35;
    const open = price;
    const close = Math.max(1, price + drift + wave);
    const high = Math.max(open, close) + 0.45;
    const low = Math.min(open, close) - 0.45;
    candles.push({ t: i * 60_000, o: open, h: high, l: low, c: close, v: 1000 + i });
    price = close;
  }
  return candles;
}

const candles = syntheticCandles(220);
for (const strategy of starterStrategies) {
  const result = runBacktest({
    strategy,
    symbol: "BTC",
    candles,
    costs: {
      feeBps: 4.5,
      slippageBps: 2,
    },
  });
  console.log(JSON.stringify({
    strategy: result.strategyId,
    trades: result.trades.length,
    totalPnlPct: Number(result.totalPnlPct.toFixed(3)),
    winRate: Number((result.winRate * 100).toFixed(1)),
    maxDrawdownPct: Number(result.maxDrawdownPct.toFixed(3)),
  }));
}
