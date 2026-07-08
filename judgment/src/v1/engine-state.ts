import type { Candle } from "../shared/types";
import type { VolumeProfile, PriceLevel, RegimeMetrics, OrderflowStats } from "../shared/market/metrics";
import type { OrderflowTrade, BboSnapshot } from "../shared/market/input";

export type EngineState = {
  asset: string;
  initialized: boolean;

  candles: Candle[];
  lastCandleAt: number;
  lastPrice: number;

  volumeProfile: VolumeProfile | null;
  vpAnchorPrice: number;
  vpRadiusPct: number;
  vpBinCount: number;

  levels: PriceLevel[];
  swingLeft: number;
  swingRight: number;
  levelTolerancePct: number;
  levelMinTouches: number;

  regime: RegimeMetrics;
  regimeWindowMs: number;

  trades: OrderflowTrade[];
  tradeStartIndex: number;
  orderflowWindowMs: number;
  bbo: BboSnapshot | null;
  bboHistory: BboSnapshot[];
  bboStartIndex: number;

  orderflowStats: OrderflowStats;
};

export type EngineConfig = {
  asset: string;
  vpAnchorPrice?: number;
  vpRadiusPct?: number;
  vpBinCount?: number;
  swingLeft?: number;
  swingRight?: number;
  levelTolerancePct?: number;
  levelMinTouches?: number;
  regimeWindowMs?: number;
  orderflowWindowMs?: number;
};
