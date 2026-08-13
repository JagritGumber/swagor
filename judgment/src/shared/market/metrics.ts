export type VolumeProfile = {
  low: number;
  high: number;
  binSize: number;
  poc: number;
  valueAreaLow: number;
  valueAreaHigh: number;
  bins: VolumeBin[];
};

export type VolumeBin = {
  low: number;
  high: number;
  mid: number;
  volume: number;
};

export type PriceLevel = {
  price: number;
  kind: "support" | "resistance";
  touches: number;
  lastTouchedAt: number;
};

export type RegimeMetrics = {
  mode: "range" | "trend-up" | "trend-down" | "high-vol" | "unknown";
  highVol: boolean;
  rangePct: number;
  driftPct: number;
  directionalEfficiency: number;
};

export type PriceLocation =
  | "below-value"
  | "value-low"
  | "near-poc"
  | "value-high"
  | "above-value"
  | "outside-profile";

export type AbsorptionEvent =
  | "none"
  | "buy-absorption"
  | "sell-absorption"
  | "confirmed-absorption"
  | "aggressive-absorption";

export type OrderflowStats = {
  buyVolume: number;
  sellVolume: number;
  delta: number;
  tradeCount: number;
  averageTradeSize: number;
  largestTradeSize: number;
  dominantSide: "buy" | "sell" | "none";
  absorption: AbsorptionEvent;
  tapeActivity: "thin" | "active" | "heavy";
};

export type MarketMetrics = {
  lastPrice: number;
  lastCandleAt: number;
  volumeProfile: VolumeProfile | null;
  levels: PriceLevel[];
  regime: RegimeMetrics;
  priceLocation: PriceLocation;
  orderflow: OrderflowStats;
};
