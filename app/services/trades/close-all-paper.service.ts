import "server-only";

import { db } from "@/lib/db/client";
import { trades } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { fetchAllMids } from "@/lib/data-sources/hyperliquid";
import { closePaperTrade } from "./paper-trade.service";

export type CloseAllResult = {
  closed: number;
  failed: Array<{ tradeId: string; reason: string }>;
};

/**
 * Close every open paper trade for a Selbo instance at the current
 * Hyperliquid mark. Called from the pause flow when the user opts in to
 * having Selbo close positions before going dark.
 *
 * Best-effort: a single failed close does not abort the batch; failures
 * land in the response so the caller can surface them in a toast.
 *
 * Race: the watcher runs independently every minute. Closes complete
 * BEFORE the route flips `killSwitchActive`; a ~1-2s window remains
 * where the watcher could reopen on the now-empty set, but the next
 * tick after the flip sees kill switch on and stops.
 */
export async function closeAllOpenPaperTrades(input: {
  userId: string;
  selboInstanceId: string;
}): Promise<CloseAllResult> {
  const open = await db.select().from(trades).where(
    and(eq(trades.userId, input.userId), eq(trades.status, "open")),
  );
  if (open.length === 0) return { closed: 0, failed: [] };

  const mids = await fetchAllMids().catch(() => ({} as Record<string, string>));

  const settled = await Promise.allSettled(
    open.map((t) => {
      const mid = mids[t.asset.toUpperCase()];
      const markPriceUsd = mid ? Number(mid) : null;
      return closePaperTrade({
        userId: input.userId,
        selboInstanceId: input.selboInstanceId,
        asset: t.asset,
        markPriceUsd,
        source: "user-pause",
        rationale: "User paused Selbo and elected to close open positions",
      });
    }),
  );

  const failed: CloseAllResult["failed"] = [];
  let closed = 0;
  settled.forEach((r, idx) => {
    if (r.status === "fulfilled") {
      if (r.value) closed++;
    } else {
      failed.push({
        tradeId: open[idx]!.id,
        reason: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  });

  return { closed, failed };
}
