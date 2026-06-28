export type ReaderMarketRegimeMode = "range" | "trend-up" | "trend-down" | "high-vol" | "unknown";

export type ReaderMarketRegime = {
  mode: ReaderMarketRegimeMode;
  highVol: boolean;
  rangePct: number;
  driftPct: number;
  directionalEfficiency: number;
  reason: string;
};

export type RegimeSegment = {
  startIndex: number;
  endIndex: number;
  startTime: number;
  endTime: number;
  mode: ReaderMarketRegimeMode;
  poc: number;
  valueAreaLow: number;
  valueAreaHigh: number;
};
