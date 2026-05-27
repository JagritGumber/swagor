import type { AuctionRead } from "../read/types";
import type { OrderflowRead } from "../orderflow/types";

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
  stance: LiveReaderStance;
  narrative: string;
  invalidation: string | null;
  target: string | null;
};
