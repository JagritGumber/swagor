import type { OrderflowEvent } from "../orderflow/types";
import type { ReaderHistoryAuctionConfig } from "../reader-history/types";
import type { Candle } from "../types";

export type ReaderScenario = {
  name: string;
  asset: string;
  interval: string;
  candleIntervalMs: number;
  readIntervalMs: number;
  orderflowWindowMs: number;
  startAt: number;
  endAt: number;
  candles: Candle[];
  orderflowEvents: OrderflowEvent[];
  auctionConfig: ReaderHistoryAuctionConfig;
};
