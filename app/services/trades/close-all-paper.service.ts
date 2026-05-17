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
  walletId: string;
  selboInstanceId: string;
}): Promise<CloseAllResult> {
  const open = await db.select().from(trades).where(
    and(eq(trades.userId, input.userId), eq(trades.status, "open")),
  );
  if (open.length === 0) return { closed: 0, failed: [] };

  const mids = await fetchAllMids().catch(() => ({} as Record<string, string>));

  // closePaperTrade calls input.markPriceUsd.toString() with no null
  // guard, so we cannot pass null here. Partition trades by whether
  // their mark is available; tradeable ones get closed, the rest land
  // in failures with a clear reason so the user can retry later.
  const tradeable: Array<{ id: string; asset: string; markPriceUsd: number }> = [];
  const failed: CloseAllResult["failed"] = [];
  for (const t of open) {
    const mid = mids[t.asset.toUpperCase()];
    if (!mid) {
      failed.push({ tradeId: t.id, reason: "Hyperliquid mark unavailable; close manually" });
      continue;
    }
    const n = Number(mid);
    if (!Number.isFinite(n)) {
      failed.push({ tradeId: t.id, reason: `mark ${mid} is not a finite number` });
      continue;
    }
    tradeable.push({ id: t.id, asset: t.asset, markPriceUsd: n });
  }

  const settled = await Promise.allSettled(
    tradeable.map((t) =>
      closePaperTrade({
        userId: input.userId,
        walletId: input.walletId,
        selboInstanceId: input.selboInstanceId,
        asset: t.asset,
        markPriceUsd: t.markPriceUsd,
        source: "user-pause",
        rationale: "User paused Selbo and elected to close open positions",
      }),
    ),
  );

  let closed = 0;
  settled.forEach((r, idx) => {
    const t = tradeable[idx];
    if (!t) return;
    if (r.status === "fulfilled") {
      if (r.value) closed++;
    } else {
      failed.push({
        tradeId: t.id,
        reason: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  });

  return { closed, failed };
}
