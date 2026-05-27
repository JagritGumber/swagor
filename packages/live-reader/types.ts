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
  onSessionEvent?(event: LiveReaderSessionEvent): void;
  onStatus?(status: string): void;
  onError?(error: unknown): void;
};

export type LiveReaderSessionEvent =
  | { type: "orderflow-status"; status: string; at: number }
  | { type: "auction-refresh-started"; asset: string; at: number }
  | { type: "auction-refresh-completed"; asset: string; candleCount: number; at: number }
  | { type: "auction-refresh-failed"; asset: string; message: string; at: number }
  | { type: "read-emitted"; asset: string; stance: LiveReaderRead["stance"]; planStatus: ReaderTradePlan["status"]; at: number };
