import { exitFor } from "./exit-for";
import { summarizeTrades } from "./summarize-trades";
import { tradePnl } from "./trade-pnl";
import type { BacktestResult, Candle, MarketCosts, MarketContext, OpenTrade, Strategy, Trade } from "@strategy-lab/types";

export function runBacktest(input: {
  strategy: Strategy;
  symbol: string;
  candles: Candle[];
  costs: MarketCosts;
}): BacktestResult {
  const trades: Trade[] = [];
  let open: OpenTrade | null = null;

  for (let i = input.strategy.warmupCandles; i < input.candles.length; i++) {
    const candle = input.candles[i];
    const ctx: MarketContext = {
      symbol: input.symbol,
      candles: input.candles,
      index: i,
      costs: input.costs,
    };

    if (open) {
      const exit = exitFor(open, candle);
      if (exit) {
        trades.push({
          strategyId: input.strategy.id,
          symbol: input.symbol,
          side: open.side,
          entryTime: open.entryTime,
          exitTime: candle.t,
          entry: open.entry,
          exit: exit.price,
          pnlPct: tradePnl(open.side, open.entry, exit.price, input.costs),
          exitReason: exit.reason,
        });
        open = null;
      }
      continue;
    }

    const signal = input.strategy.evaluate(ctx);
    if (signal.action === "enter") {
      open = { side: signal.side, entry: candle.c, entryTime: candle.t, stop: signal.stop, target: signal.target };
    }
  }

  const last = input.candles[input.candles.length - 1];
  if (open && last) {
    trades.push({
      strategyId: input.strategy.id,
      symbol: input.symbol,
      side: open.side,
      entryTime: open.entryTime,
      exitTime: last.t,
      entry: open.entry,
      exit: last.c,
      pnlPct: tradePnl(open.side, open.entry, last.c, input.costs),
      exitReason: "end",
    });
  }

  return {
    strategyId: input.strategy.id,
    symbol: input.symbol,
    trades,
    ...summarizeTrades(trades),
  };
}


