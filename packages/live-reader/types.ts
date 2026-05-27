import type { CandleInterval, HyperliquidNetwork } from "../market-data";
import type { LiveReaderRead, ReaderTradePlan, ReaderTradePlanConfig } from "../strategy-lab";

export type LiveReaderSessionInput = {
  vmUrl: string;
  network: HyperliquidNetwork;
  asset: string;
  interval: CandleInterval;
  days: number;
  seconds: number;
  rootDir: string;
  readIntervalMs?: number;
  orderflowWindowMs?: number;
  auctionRefreshMs?: number;
  tradePlanConfig?: ReaderTradePlanConfig;
  onRead(read: LiveReaderRead): void;
  onPlan?(read: LiveReaderRead, plan: ReaderTradePlan): void;
  onStatus?(status: string): void;
  onError?(error: unknown): void;
};
