import type { Side } from "../shared/types";
import type { MarketMetrics } from "../shared/market/metrics";

export type JudgmentAction =
  | { type: "enter"; side: Side; entry: number; stop: number; target: number; confidence: number }
  | { type: "hold"; positionId: string }
  | { type: "exit"; positionId: string; reason: string }
  | { type: "no-trade" };

export type Judgment = {
  id: string;
  asset: string;
  timestamp: number;
  action: JudgmentAction;
  metrics: MarketMetrics;
  reason: string;
  invalidation: string | null;
};

export type JudgmentRecord = Judgment & {
  outcome?: {
    resolvedAt: number;
    result: "win" | "loss" | "breakeven" | "invalidated" | "expired";
    pnlPct: number;
    exitPrice: number;
    exitReason: string;
  };
};
