import type { AuctionRead } from "../read/types";
import type { OrderflowRead } from "../orderflow/types";
import type { ReaderMarketRegime } from "../market-regime/types";
import type { ReaderAuctionMode } from "../reader-auction-mode/types";
import type { ReaderNarrative } from "../reader-narrative/types";
import type { Candle } from "../types";

export type LiveReaderStance =
  | "wait"
  | "watch-long-confirmation"
  | "watch-short-confirmation"
  | "possible-long"
  | "possible-short"
  | "avoid-balanced-auction";

export type LiveReaderRead = {
  asset: string;
  auction: AuctionRead;
  orderflow: OrderflowRead;
  auctionMode?: ReaderAuctionMode;
  regime?: ReaderMarketRegime;
  lastClosedCandle?: Candle | null;
  stance: LiveReaderStance;
  narrativeRead?: ReaderNarrative;
  narrative: string;
  invalidation: string | null;
  target: string | null;
};
