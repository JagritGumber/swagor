export type Side = "long" | "short";

export type JudgmentAction =
  | { type: "enter"; side: Side; entry: number; stop: number; target: number; confidence: number }
  | { type: "hold"; positionId: string }
  | { type: "exit"; positionId: string; reason: string }
  | { type: "no-trade" };

export type PositionStatus = "open" | "closed";

export type Position = {
  id: string;
  asset: string;
  side: Side;
  entryPrice: number;
  entryTime: number;
  size: number;
  stop: number;
  target: number;
  status: PositionStatus;
  exitPrice?: number;
  exitTime?: number;
  exitReason?: "stop" | "target" | "manual" | "invalidation" | "expiry";
  pnlPct?: number;
  judgmentId: string;
};

export type PortfolioSnapshot = {
  timestamp: number;
  equity: number;
  positions: Position[];
  dailyPnl: number;
  totalPnl: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  openPositionCount: number;
};

export type PortfolioConfig = {
  initialEquity: number;
  riskPerTradePct: number;
  maxOpenPositions: number;
};
