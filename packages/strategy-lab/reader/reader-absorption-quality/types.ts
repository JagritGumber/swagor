import type { OrderflowEvidenceTier, OrderflowSide } from "../../read-core/orderflow/types";
import type { AuctionLocation } from "../../read-core/read/types";
import type { ReaderAuctionModeName, ReaderAuctionPhase } from "../reader-auction-mode/types";
import type { ReaderVpAuctionState, ReaderVpPocState, ReaderVpValueState } from "../reader-vp-state/types";
import type { Side } from "../../types";

export type ReaderAbsorptionQualityKind =
  | "trap-confirmed"
  | "no-rotation"
  | "churn"
  | "continuation-risk"
  | "unknown";

export type ReaderAbsorptionQuality = {
  quality: ReaderAbsorptionQualityKind;
  side: Side | "none";
  absorbedSide: OrderflowSide | "none";
  reasons: string[];
  auctionLocation: AuctionLocation;
  auctionMode: ReaderAuctionModeName | "unknown";
  auctionPhase: ReaderAuctionPhase | "unknown";
  vpAuction: ReaderVpAuctionState | "unknown";
  vpPoc: ReaderVpPocState | "unknown";
  vpValue: ReaderVpValueState | "unknown";
  priceToPoc: "below-poc" | "above-poc" | "at-poc" | "no-poc";
  targetMovesTowardPoc: boolean;
  evidence: {
    absorption: OrderflowEvidenceTier | "unknown";
    print: "none" | "local-standout" | "unknown";
    followThrough: "holding" | "stalled" | "unknown";
    largestTradeSideMatchesAbsorbedSide: boolean;
  };
};

export type ReaderAbsorptionPolicy =
  | "raw-edge"
  | "block-continuation-risk"
  | "require-stalled"
  | "require-local-standout"
  | "require-attacker-print"
  | "require-toward-poc"
  | "require-stalled-attacker-print"
  | "require-stalled-toward-poc"
  | "require-vp-not-against"
  | "no-rotation-only"
  | "strict-trap";

export const READER_ABSORPTION_POLICIES: ReaderAbsorptionPolicy[] = [
  "raw-edge",
  "block-continuation-risk",
  "require-stalled",
  "require-local-standout",
  "require-attacker-print",
  "require-toward-poc",
  "require-stalled-attacker-print",
  "require-stalled-toward-poc",
  "require-vp-not-against",
  "no-rotation-only",
  "strict-trap",
];


