import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { dailyPlans, selboInstances } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the caller's latest daily_plan row. Prefers status='complete';
 * if none, falls back to the most recent row (so failed/pending states
 * can be surfaced to the user). 404 when no rows exist yet.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const [instance] = await db.select({ id: selboInstances.id }).from(selboInstances)
    .where(eq(selboInstances.userId, userId)).limit(1);
  if (!instance) return NextResponse.json({ plan: null }, { status: 404 });

  const [completed] = await db.select().from(dailyPlans)
    .where(and(eq(dailyPlans.selboInstanceId, instance.id), eq(dailyPlans.status, "complete")))
    .orderBy(desc(dailyPlans.generatedAt)).limit(1);
  if (completed) return NextResponse.json({ plan: completed });

  const [latest] = await db.select().from(dailyPlans)
    .where(eq(dailyPlans.selboInstanceId, instance.id))
    .orderBy(desc(dailyPlans.generatedAt)).limit(1);
  return NextResponse.json({ plan: latest ?? null });
}
