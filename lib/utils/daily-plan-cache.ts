import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { dailyPlans, type DailyPlan } from "@/lib/db/schema";

const TTL_MS = 5 * 60 * 1000;

type CacheEntry = { value: DailyPlan | null; expiresAt: number };
const cache = new Map<string, CacheEntry>();

/**
 * 5-minute in-memory cache for the latest daily_plan row per user. Used by
 * the watcher so per-tick reads don't hit the DB every minute.
 * Module-scoped Map -- this is fine on Fluid Compute because the same warm
 * function instance handles many requests, and cold starts naturally
 * invalidate the cache.
 */
export async function getCachedDailyPlan(userId: string): Promise<DailyPlan | null> {
  const now = Date.now();
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > now) return cached.value;

  const [row] = await db.select().from(dailyPlans)
    .where(and(eq(dailyPlans.userId, userId), eq(dailyPlans.status, "complete")))
    .orderBy(desc(dailyPlans.generatedAt))
    .limit(1);

  const value = row ?? null;
  cache.set(userId, { value, expiresAt: now + TTL_MS });
  return value;
}

export function invalidateDailyPlanCache(userId: string): void {
  cache.delete(userId);
}
