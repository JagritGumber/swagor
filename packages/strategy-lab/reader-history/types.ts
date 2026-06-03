import type { OrderflowEvent } from "../orderflow/types";
import type { LiveReaderRead } from "../reader-live/types";
import type { ReaderReplayInput, ReaderReplayResult, ReaderReplayStep } from "../reader-replay/types";
import type { Candle } from "../types";

export type ReaderHistoryAuctionConfig = {
  swingLeft?: number;
  swingRight?: number;
  levelCandles?: number;
  levelTolerancePct?: number;
  levelMinTouches?: number;
  maxLevelDistancePct?: number;
  profileCandles?: number;
  profileRadiusPct?: number;
  profileBins?: number;
  profileTradeWindowMs?: number;
  profileTradeSampleLimit?: number;
};

export type ReaderHistoryInput = {
  asset: string;
  interval: string;
  candleIntervalMs: number;
  candles: Candle[];
  orderflowEvents: OrderflowEvent[];
  readIntervalMs: number;
  alignReadsToMs?: number;
  orderflowWindowMs?: number;
  startAt?: number;
  endAt?: number;
  auctionConfig?: ReaderHistoryAuctionConfig;
};

export type ReaderHistoryStep = {
  now: number;
  read: LiveReaderRead;
};

export type ReaderHistoryReplayInput = ReaderHistoryInput & {
  replay?: Omit<ReaderReplayInput, "reads">;
};

export type ReaderHistoryReplayResult = ReaderReplayResult & {
  historySteps: ReaderHistoryStep[];
};
