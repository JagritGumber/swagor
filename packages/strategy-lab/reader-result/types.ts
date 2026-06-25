import type { ReaderSetupResult } from "../reader-setup/types";
import type { ReaderMarketRegime } from "../read-core/market-regime/types";
import type { ReaderAuctionMode } from "../reader-auction-mode/types";
import type { ReaderNarrative } from "../reader-narrative/types";
import type { ReaderActionableTradePlan } from "../bt-core/trade-plan/types";

export type ReaderResultExitReason = "stop" | "target" | "reader-failure";

export type ReaderResultEntry = {
  asset: string;
  setupKey: string | null;
  setupFamily?: ReaderActionableTradePlan["setupFamily"];
  regime?: ReaderMarketRegime;
  sequencePhase?: ReaderActionableTradePlan["sequencePhase"];
  sequenceReason?: string;
  side: ReaderActionableTradePlan["side"];
  entryPrice: number;
  entryAt: number;
  entryAuctionLocation?: string;
  entryAuctionLevelKind?: string | null;
  stop: number;
  target: number;
  confidence: number;
  bestFavorableR?: number;
  pricedReadsAfterEntry?: number;
  auctionMode?: ReaderAuctionMode;
  narrative?: ReaderNarrative;
  narrativeKey?: string | null;
  reasons: string[];
};

export type ReaderResultOutcome = ReaderResultEntry & {
  exitPrice: number;
  exitAt: number;
  exitReason: ReaderResultExitReason;
  r: number;
};

export type ReaderResultEvent =
  | {
      type: "entry-opened";
      asset: string;
      side: ReaderResultEntry["side"];
      price: number;
      at: number;
      reason: string;
    }
  | {
      type: "entry-skipped";
      asset: string;
      at: number;
      reason: string;
    }
  | {
      type: "position-held";
      asset: string;
      side: ReaderResultEntry["side"];
      price: number;
      at: number;
      reason: string;
    }
  | {
      type: "position-unpriced";
      asset: string;
      side: ReaderResultEntry["side"];
      at: number;
      reason: string;
    }
  | {
      type: "stop-hit" | "target-hit" | "reader-failure-exit";
      asset: string;
      side: ReaderResultEntry["side"];
      price: number;
      r: number;
      at: number;
      reason: string;
    };

export type ReaderResultState = {
  open: ReaderResultEntry | null;
  outcomes: ReaderResultOutcome[];
  events: ReaderResultEvent[];
  maxEvents: number;
};

export type ReaderResultUpdate = {
  input: ReaderSetupResult;
  state: ReaderResultState;
  events: ReaderResultEvent[];
  opened: ReaderResultEntry | null;
  closed: ReaderResultOutcome | null;
};
