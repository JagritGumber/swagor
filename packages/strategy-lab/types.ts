export type Candle = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

export type MarketCosts = {
  feeBps: number;
  slippageBps: number;
};

export type MarketContext = {
  symbol: string;
  candles: Candle[];
  index: number;
  costs: MarketCosts;
};

export type Side = "long" | "short";

export type Signal =
  | { action: "hold"; reason: string }
  | {
      action: "enter";
      side: Side;
      reason: string;
      riskPct: number;
      stop: number;
      target: number;
    };

export type Strategy = {
  id: string;
  label: string;
  timeframe: string;
  warmupCandles: number;
  evaluate(ctx: MarketContext): Signal;
};

export type OpenTrade = {
  side: Side;
  entry: number;
  entryTime: number;
  stop: number;
  target: number;
};

export type Trade = {
  strategyId: string;
  symbol: string;
  side: Side;
  entryTime: number;
  exitTime: number;
  entry: number;
  exit: number;
  pnlPct: number;
  exitReason: "stop" | "target" | "end";
};

export type BacktestMetrics = {
  totalPnlPct: number;
  winRate: number;
  maxDrawdownPct: number;
};

export type BacktestResult = BacktestMetrics & {
  strategyId: string;
  symbol: string;
  trades: Trade[];
};

