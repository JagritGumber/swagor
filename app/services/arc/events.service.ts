import "server-only";

import { db } from "@/lib/db/client";
import { selboInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { analysisEvents, tickEvents, tradeEvents, type ArcEvent } from "./event-sources";

export type { ArcEvent };

/** Clamp the user-supplied limit to [1, 50] with default 20; rejects NaN
 *  / non-finite values silently so a bad `?limit=abc` doesn't 500. */
export function clampLimit(raw: string | null): number {
  const n = Number(raw ?? "20");
  if (!Number.isFinite(n)) return 20;
  return Math.min(Math.max(Math.floor(n), 1), 50);
}

/**
 * Gather a user's most-recent Arc anchor events across four sources:
 * trade opens, trade closes, watcher decisions, and anchored daily
 * analyses. Newest first, capped at `limit`.
 */
export async function collectArcEvents(userId: string, limit: number): Promise<ArcEvent[]> {
  const [instance] = await db.select({ id: selboInstances.id })
    .from(selboInstances).where(eq(selboInstances.userId, userId)).limit(1);
  if (!instance) return [];

  const [tradesE, ticksE, analysesE] = await Promise.all([
    tradeEvents(userId, limit),
    tickEvents(instance.id, limit),
    analysisEvents(userId, limit),
  ]);

  return [...tradesE, ...ticksE, ...analysesE]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
