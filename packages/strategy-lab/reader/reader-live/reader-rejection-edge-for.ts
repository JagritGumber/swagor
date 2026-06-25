import type { AuctionRead } from "../../read-core/read/types";
import type { Side } from "../../types";

export type ReaderRejectionEdge = {
  side: Side;
  kind: "support" | "resistance";
};

export function readerRejectionEdgeFor(auction: AuctionRead): ReaderRejectionEdge | null {
  if (auction.level?.kind === "support" && (auction.location === "value-low" || auction.location === "below-value")) {
    return { side: "long", kind: "support" };
  }
  if (auction.level?.kind === "resistance" && (auction.location === "value-high" || auction.location === "above-value")) {
    return { side: "short", kind: "resistance" };
  }
  return null;
}


