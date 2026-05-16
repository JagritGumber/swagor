import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { dailyPlans, selboInstances, trades } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UTC_DAY_START = sql`date_trunc('day', now() AT TIME ZONE 'UTC')`;

/**
 * Status snapshot for the navbar pill + pause dialog defaults.
 * Returns the three signals the UI needs in one round trip so the pill
 * can drive both its dot color and the dialog's checkbox visibility.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [instance] = await db.select({
    id: selboInstances.id,
    killSwitchActive: selboInstances.killSwitchActive,
  }).from(selboInstances).where(eq(selboInstances.userId, session.user.id)).limit(1);
  if (!instance) return NextResponse.json({ error: "No Selbo instance" }, { status: 404 });

  const [open, plan] = await Promise.all([
    db.select({ id: trades.id }).from(trades)
      .where(and(eq(trades.userId, session.user.id), eq(trades.status, "open"))).limit(1),
    db.select({ id: dailyPlans.id }).from(dailyPlans)
      .where(and(
        eq(dailyPlans.selboInstanceId, instance.id),
        eq(dailyPlans.status, "complete"),
        gte(dailyPlans.generatedAt, UTC_DAY_START as unknown as Date),
      ))
      .orderBy(desc(dailyPlans.generatedAt)).limit(1),
  ]);

  return NextResponse.json({
    killSwitchActive: instance.killSwitchActive,
    hasOpenPositions: open.length > 0,
    hasTodayPlan: plan.length > 0,
  });
}
