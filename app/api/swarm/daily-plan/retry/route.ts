import { NextResponse } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { dailyPlans, selboInstances } from "@/lib/db/schema";
import { runDailyPlanForInstance } from "@/app/services/swarm/daily-planner.service";
import { invalidateDailyPlanCache } from "@/lib/utils/daily-plan-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UTC_DAY_START = sql`date_trunc('day', now() AT TIME ZONE 'UTC')`;

/**
 * Retry endpoint hit at 00:30 UTC. Re-runs any daily_plans rows from the
 * current UTC day still in status='failed'. The planner orchestrator's
 * idempotency check would short-circuit a completed plan, but a failed row
 * does NOT block; running again creates a fresh row and the brain page
 * reads the latest by generatedAt DESC.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
    }
  } else {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const failed = await db.select({ instanceId: dailyPlans.selboInstanceId })
    .from(dailyPlans)
    .where(and(eq(dailyPlans.status, "failed"), gte(dailyPlans.generatedAt, UTC_DAY_START as unknown as Date)));

  const ids = Array.from(new Set(failed.map((r) => r.instanceId)));
  if (ids.length === 0) return NextResponse.json({ retried: 0 });

  const instances = await Promise.all(ids.map((id) =>
    db.select().from(selboInstances).where(eq(selboInstances.id, id)).limit(1).then((r) => r[0]),
  ));

  const results = await Promise.allSettled(
    instances.filter((i): i is NonNullable<typeof i> => Boolean(i))
      .map((inst) => runDailyPlanForInstance(inst, "daily").then((r) => {
        if (r.status === "complete") invalidateDailyPlanCache(inst.userId);
        return { instanceId: inst.id, ...r };
      })),
  );

  return NextResponse.json({
    retried: results.length,
    results: results.map((r) => r.status === "fulfilled" ? r.value : { error: String(r.reason) }),
  });
}

export const GET = POST;
