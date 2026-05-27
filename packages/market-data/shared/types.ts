import type { Candle } from "../../strategy-lab";

export type HyperliquidNetwork = "mainnet" | "testnet";
export type CandleInterval = "5m" | "1h";

export type CandleQuery = {
  network: HyperliquidNetwork;
  asset: string;
  interval: CandleInterval;
  startMs: number;
  endMs: number;
};

export type StoredCandle = Candle & {
  asset: string;
  interval: CandleInterval;
  network: HyperliquidNetwork;
  venue: "hyperliquid";
};

export type HyperliquidCandle = {
  t: number;
  T: number;
  s: string;
  i: string;
  o: string;
  c: string;
  h: string;
  l: string;
  v: string;
  n: number;
};

export type VictoriaMetricsExportSeries = {
  metric: Record<string, string>;
  values: number[];
  timestamps: number[];
};
