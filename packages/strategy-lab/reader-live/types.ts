import type { AuctionRead } from "../read/types";
import type { OrderflowRead } from "../orderflow/types";
import type { ReaderMarketRegime } from "../market-regime/types";
import type { ReaderAuctionMode } from "../reader-auction-mode/types";
import type { ReaderAbsorptionPolicy, ReaderAbsorptionQuality } from "../reader-absorption-quality/types";
import type { ReaderNarrative } from "../reader-narrative/types";
import type { ReaderVpState } from "../reader-vp-state/types";
import type { Candle } from "../types";

export type LiveReaderStance =
  | "wait"
  | "watch-long-confirmation"
  | "watch-short-confirmation"
  | "possible-long"
  | "possible-short"
  | "avoid-balanced-auction";

export type LiveReaderConfig = {
  absorptionPolicy?: ReaderAbsorptionPolicy;
};

export type ReaderLocalRangeLocation =
  | "lower-edge"
  | "middle"
  | "upper-edge"
  | "unknown";

export type ReaderLocalRange = {
  high: number | null;
  low: number | null;
  position: number | null;
  location: ReaderLocalRangeLocation;
};

export type LiveReaderRead = {
  asset: string;
  auction: AuctionRead;
  orderflow: OrderflowRead;
  absorptionQuality?: ReaderAbsorptionQuality;
  auctionMode?: ReaderAuctionMode;
  vpState?: ReaderVpState;
  regime?: ReaderMarketRegime;
  lastClosedCandle?: Candle | null;
  localRange?: ReaderLocalRange;
  stance: LiveReaderStance;
  narrativeRead?: ReaderNarrative;
  narrative: string;
  invalidation: string | null;
  target: string | null;
};
