import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db/client";
import { selboInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { runDailyPlanForInstance } from "@/app/services/swarm/daily-planner.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Admin-only synchronous force-run for the caller's own daily plan.
 * Bypasses the cron schedule + the kill-switch fire-and-forget path so
 * any orchestrator failure surfaces in the response body instead of
 * disappearing into server logs. Honors the orchestrator's idempotency
 * and cost-cap checks; status='skipped' results carry the reason.
 */
export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [instance] = await db.select().from(selboInstances)
    .where(eq(selboInstances.userId, session.user.id)).limit(1);
  if (!instance) return NextResponse.json({ error: "No Selbo instance" }, { status: 404 });

  try {
    const result = await runDailyPlanForInstance(instance, "daily");
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/force-daily-plan] orchestrator threw:", message);
    return NextResponse.json({ status: "errored", reason: message }, { status: 500 });
  }
}
