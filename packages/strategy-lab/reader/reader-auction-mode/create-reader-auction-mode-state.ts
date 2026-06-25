import type { ReaderAuctionModeState } from "./types";

export function createReaderAuctionModeState(): ReaderAuctionModeState {
  return {
    previousLocation: null,
    previousPressure: null,
    lastExpansionDirection: null,
    failedExpansionDirection: null,
    pocGravity: false,
  };
}


