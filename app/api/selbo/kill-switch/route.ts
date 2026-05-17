import { NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { dailyPlans, selboInstances } from "@/lib/db/schema";
import { closeAllOpenPaperTrades } from "@/app/services/trades/close-all-paper.service";
import { runDailyPlanForInstance } from "@/app/services/swarm/daily-planner.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  active: z.boolean().optional(),
  closeOpenPositions: z.boolean().optional(),
}).strict();

const UTC_DAY_START = sql`date_trunc('day', now() AT TIME ZONE 'UTC')`;

/**
 * Toggle Selbo's kill switch.
 *
 * On RESUME (active=false): if no complete daily_plans row exists for
 * today UTC, fire runDailyPlanForInstance fire-and-forget so a brand-new
 * user gets their first plan as soon as they enable. The orchestrator's
 * idempotency check filters status=complete, so a same-day re-enable
 * does NOT trigger a duplicate plan.
 *
 * On PAUSE (active=true) with closeOpenPositions=true: close every open
 * paper trade at current mark BEFORE flipping the flag. Race window of
 * ~1-2s where the watcher could reopen is acceptable; the next tick
 * after the flip stops.
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawBody = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const body = parsed.data;

  const [current] = await db.select().from(selboInstances)
    .where(eq(selboInstances.userId, session.user.id)).limit(1);
  if (!current) return NextResponse.json({ error: "No Selbo instance" }, { status: 404 });

  const nextActive = typeof body.active === "boolean" ? body.active : !current.killSwitchActive;

  let closedPositions: Awaited<ReturnType<typeof closeAllOpenPaperTrades>> | undefined;
  if (nextActive === true && body.closeOpenPositions === true) {
    closedPositions = await closeAllOpenPaperTrades({
      userId: current.userId,
      walletId: current.circleWalletId,
      selboInstanceId: current.id,
    });
  }

  const [updated] = await db.update(selboInstances)
    .set({ killSwitchActive: nextActive })
    .where(eq(selboInstances.userId, session.user.id))
    .returning();

  let triggeredFirstPlan = false;
  if (nextActive === false) {
    const [todayPlan] = await db.select({ id: dailyPlans.id }).from(dailyPlans)
      .where(and(
        eq(dailyPlans.selboInstanceId, current.id),
        eq(dailyPlans.status, "complete"),
        gte(dailyPlans.generatedAt, UTC_DAY_START as unknown as Date),
      )).limit(1);
    if (!todayPlan) {
      triggeredFirstPlan = true;
      void runDailyPlanForInstance(updated, "daily").catch((err) => {
        console.error("[kill-switch] first-plan fire-and-forget failed:", err);
      });
    }
  }

  return NextResponse.json({
    killSwitchActive: updated.killSwitchActive,
    closedPositions,
    triggeredFirstPlan,
  });
}
