import type { AuctionRead } from "../read/types";

export type ReaderVpPocState =
  | "unknown"
  | "poc-stable"
  | "poc-migrating-up"
  | "poc-migrating-down";

export type ReaderVpValueState =
  | "unknown"
  | "value-stable"
  | "value-expanding-up"
  | "value-expanding-down"
  | "value-compressing";

export type ReaderVpAuctionState =
  | "unknown"
  | "poc-chop"
  | "accepting-above-value"
  | "accepting-below-value"
  | "rejecting-above-value"
  | "rejecting-below-value"
  | "inside-value";

export type ReaderVpState = {
  poc: ReaderVpPocState;
  value: ReaderVpValueState;
  auction: ReaderVpAuctionState;
  reasons: string[];
};

export type ReaderVpStateMemory = {
  previousProfile: AuctionRead["profile"] | null;
  previousLocation: AuctionRead["location"] | null;
  previousAuction: ReaderVpAuctionState | null;
};
