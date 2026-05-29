export type ReaderMarketRegimeMode = "range" | "trend-up" | "trend-down" | "high-vol" | "unknown";

export type ReaderMarketRegime = {
  mode: ReaderMarketRegimeMode;
  highVol: boolean;
  rangePct: number;
  driftPct: number;
  directionalEfficiency: number;
  reason: string;
};
