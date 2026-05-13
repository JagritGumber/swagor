import "server-only";

import { db } from "@/lib/db/client";
import { monitorTicks, solonInstances } from "@/lib/db/schema";
import { and, eq, lte, desc } from "drizzle-orm";

/**
 * Finds the watcher tick that most likely triggered this cycle: most recent
 * `escalate` verdict for this user's Solon instance at or before cycleStartedAt.
 * Returns null if none found (cycle was triggered some other way, e.g.
 * legacy dashboard button).
 */
export async function getWatcherTriggerForCycle(opts: {
  userId: string;
  cycleStartedAt: Date;
}) {
  const [instance] = await db
    .select()
    .from(solonInstances)
    .where(eq(solonInstances.userId, opts.userId))
    .limit(1);
  if (!instance) return null;

  const [tick] = await db
    .select()
    .from(monitorTicks)
    .where(
      and(
        eq(monitorTicks.solonInstanceId, instance.id),
        eq(monitorTicks.verdict, "deliberate"),
        lte(monitorTicks.createdAt, opts.cycleStartedAt),
      ),
    )
    .orderBy(desc(monitorTicks.createdAt))
    .limit(1);

  return tick ?? null;
}
