import { NextResponse } from "next/server";
import { asc, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { monitorTicks, selboInstances, tickStages } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [instance] = await db
    .select()
    .from(selboInstances)
    .where(eq(selboInstances.userId, session.user.id))
    .limit(1);

  if (!instance) {
    return NextResponse.json({ tick: null, stages: [], nextWatcherAt: null });
  }

  const [tick] = await db
    .select()
    .from(monitorTicks)
    .where(eq(monitorTicks.selboInstanceId, instance.id))
    .orderBy(desc(monitorTicks.createdAt))
    .limit(1);

  if (!tick) {
    return NextResponse.json({
      tick: null,
      stages: [],
      nextWatcherAt: instance.nextWatcherAt,
    });
  }

  const stages = await db
    .select()
    .from(tickStages)
    .where(eq(tickStages.tickId, tick.id))
    .orderBy(asc(tickStages.createdAt));

  return NextResponse.json({
    tick,
    stages,
    nextWatcherAt: instance.nextWatcherAt,
  });
}
