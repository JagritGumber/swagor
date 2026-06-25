import type { CandleInterval, HyperliquidNetwork } from "../market-data";
import type { LiveReaderRead } from "../strategy-lab/reader/reader-live/types";
import type { ReaderSetupConfig, ReaderSetupMemory, ReaderSetupResult, ReaderSetupStatus } from "../strategy-lab/reader/reader-setup/types";
import type { ReaderTradePlan, ReaderTradePlanConfig } from "../strategy-lab/bt-core/trade-plan/types";

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
  setupConfig?: ReaderSetupConfig;
  setupMemory?: ReaderSetupMemory;
  onRead(read: LiveReaderRead): void;
  onPlan?(read: LiveReaderRead, plan: ReaderTradePlan): void;
  onSetup?(result: ReaderSetupResult): void;
  onSessionEvent?(event: LiveReaderSessionEvent): void;
  onStatus?(status: string): void;
  onError?(error: unknown): void;
};

export type LiveReaderSessionEvent =
  | { type: "orderflow-status"; status: string; at: number }
  | { type: "auction-refresh-started"; asset: string; at: number }
  | { type: "auction-refresh-completed"; asset: string; candleCount: number; at: number }
  | { type: "auction-refresh-failed"; asset: string; message: string; at: number }
  | {
      type: "read-emitted";
      asset: string;
      stance: LiveReaderRead["stance"];
      planStatus: ReaderTradePlan["status"];
      setupStatus: ReaderSetupStatus | null;
      setupEvent: ReaderSetupResult["events"][number]["type"] | null;
      planSource: ReaderSetupResult["planSource"];
      at: number;
    };

