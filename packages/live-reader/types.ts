import type { CandleInterval, HyperliquidNetwork } from "../market-data";
import type { LiveReaderRead } from "../strategy-lab";

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
  onRead(read: LiveReaderRead): void;
  onStatus?(status: string): void;
  onError?(error: unknown): void;
};
