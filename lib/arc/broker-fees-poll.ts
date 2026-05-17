import "server-only";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { brokerFees } from "@/lib/db/schema";
import { registerAnchorSource } from "./poll-pending-anchors";

// Module-load side-effect: register broker_fees as a poller source so
// pollPendingAnchors backfills onchain_tx_hash for queued Circle transfers
// (same heartbeat that resolves trade + watcher + analysis anchors).
registerAnchorSource({
  name: "broker-fees",
  fetchPending: () =>
    db.select({ id: brokerFees.id, txId: brokerFees.circleTxId })
      .from(brokerFees)
      .where(and(isNotNull(brokerFees.circleTxId), isNull(brokerFees.onchainTxHash)))
      .orderBy(asc(brokerFees.createdAt))
      .limit(20),
  setOnchain: (id, v) =>
    db.update(brokerFees).set({ onchainTxHash: v }).where(eq(brokerFees.id, id)),
});
