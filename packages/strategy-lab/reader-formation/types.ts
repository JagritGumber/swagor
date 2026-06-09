import type { OrderflowEvidence, OrderflowTapeContext, OrderflowTrade } from "../orderflow/types";
import type { AuctionLocation, PriceLevel } from "../read/types";
import type { ReaderMarketRegime } from "../market-regime/types";
import type { ReaderAuctionMode } from "../reader-auction-mode/types";
import type { ReaderAbsorptionQuality } from "../reader-absorption-quality/types";
import type { ReaderHistoryStep } from "../reader-history/types";
import type { LiveReaderRead } from "../reader-live/types";
import type { ReaderVpState } from "../reader-vp-state/types";
import type { ReaderResultEntry, ReaderResultEvent, ReaderResultOutcome, ReaderResultUpdate } from "../reader-result/types";
import type { ReaderSetupEventType, ReaderSetupResult } from "../reader-setup/types";

export type ReaderFormationInput = {
  beforeEntryReads?: number;
  afterEntryReads?: number;
  historySteps?: ReaderHistoryStep[];
  setupResults?: ReaderSetupResult[];
  resultUpdates: Array<Pick<ReaderResultUpdate, "input" | "opened" | "closed" | "events">>;
  entries: ReaderResultEntry[];
  outcomes: ReaderResultOutcome[];
};

export type ReaderFormationRead = {
  asset: string;
  setupKey: string | null;
  at: number;
  lastPrice: number | null;
  stance: LiveReaderRead["stance"];
  absorptionQuality?: ReaderAbsorptionQuality;
  auctionMode?: ReaderAuctionMode;
  vp?: ReaderVpState;
  narrative?: LiveReaderRead["narrativeRead"];
  regime?: ReaderMarketRegime;
  auction: {
    location: AuctionLocation;
    bias: LiveReaderRead["auction"]["bias"];
    levelKind: PriceLevel["kind"] | null;
    levelPrice: number | null;
    poc: number | null;
    valueAreaLow: number | null;
    valueAreaHigh: number | null;
  };
  orderflow: {
    pressure: LiveReaderRead["orderflow"]["pressure"];
    delta: number;
    tradeCount: number;
    largestTrade: OrderflowTrade | null;
    evidence?: OrderflowEvidence;
    initiative?: LiveReaderRead["orderflow"]["initiative"];
    tape?: OrderflowTapeContext;
    events: string[];
  };
  setup: {
    planSource: ReaderSetupResult["planSource"];
    planStatus: ReaderSetupResult["plan"]["status"];
    setupFamily?: ReaderSetupResult["plan"]["setupFamily"];
    sequencePhase?: ReaderSetupResult["plan"]["sequencePhase"];
    sequenceReason?: string;
    eventTypes: ReaderSetupEventType[];
  };
  resultEventTypes: ReaderResultEvent["type"][];
};

export type ReaderFormationTape = {
  entry: ReaderResultEntry;
  outcome: ReaderResultOutcome | null;
  beforeEntry: ReaderFormationRead[];
  significantBeforeEntry: ReaderFormationRead[];
  afterEntry: ReaderFormationRead[];
};
