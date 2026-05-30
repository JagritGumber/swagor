import type { AuctionLocation } from "../read/types";
import type { Side } from "../types";

export type ReaderAuctionModeName =
  | "balanced-value"
  | "poc-gravity"
  | "failed-expansion"
  | "initiative-expansion"
  | "violent-unknown";

export type ReaderAuctionMode = {
  mode: ReaderAuctionModeName;
  allowedDirection: Side | "both" | "none";
  reasons: string[];
};

export type ReaderAuctionModeState = {
  previousLocation: AuctionLocation | null;
  previousPressure: "buy-pressure" | "sell-pressure" | "balanced" | null;
  lastExpansionDirection: Side | null;
  failedExpansionDirection: Side | null;
  pocGravity: boolean;
};
