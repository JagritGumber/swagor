import type { Candle } from "../types";

export type MarketInput = {
  asset: string;
  candles: Candle[];
  trades: OrderflowTrade[];
  bbo: BboSnapshot | null;
};

export type OrderflowTrade = {
  id: string;
  side: "buy" | "sell";
  price: number;
  size: number;
  time: number;
};

export type BboSnapshot = {
  bidPrice: number | null;
  bidSize: number | null;
  askPrice: number | null;
  askSize: number | null;
  time: number;
};
