import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { monitorTicks, solonInstances } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the last N watcher ticks for the calling user's Solon instance.
 * Auth-checked: a user can only see their own ticks.
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "10"), 50);

  const [instance] = await db
    .select().from(solonInstances).where(eq(solonInstances.userId, user.id)).limit(1);
  if (!instance) return NextResponse.json({ ticks: [], nextWatcherAt: null });

  const ticks = await db
    .select().from(monitorTicks)
    .where(eq(monitorTicks.solonInstanceId, instance.id))
    .orderBy(desc(monitorTicks.createdAt))
    .limit(limit);

  return NextResponse.json({
    ticks,
    nextWatcherAt: instance.nextWatcherAt,
    currentlyWatching: instance.currentlyWatching,
  });
}
