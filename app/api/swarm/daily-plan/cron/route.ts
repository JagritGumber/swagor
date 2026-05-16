import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { selboInstances } from "@/lib/db/schema";
import { runDailyPlanForInstance } from "@/app/services/swarm/daily-planner.service";
import { invalidateDailyPlanCache } from "@/lib/utils/daily-plan-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily cron entry: cron-job.org hits this once per UTC day. Loads every
 * active, beta-granted, kill-switch-off Selbo instance and runs a daily
 * plan cycle in parallel via Promise.allSettled.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}` in production. Locally no
 * secret means open access (so curl works without piping headers).
 *
 * Vercel function maxDuration is 300s by default; with 16-persona LIGHT
 * swarms each cycle is ~60-90s and we cap parallel fanout at 5 to stay in
 * the window. For >5 instances we batch (sequential batches of 5).
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

  const instances = await db.select().from(selboInstances).where(and(
    eq(selboInstances.killSwitchActive, false),
    eq(selboInstances.betaAccessGranted, true),
  ));

  const BATCH = 5;
  const results: Array<{ instanceId: string; status: string; cycleId?: string; reason?: string }> = [];
  for (let i = 0; i < instances.length; i += BATCH) {
    const slice = instances.slice(i, i + BATCH);
    const settled = await Promise.allSettled(slice.map((inst) => runDailyPlanForInstance(inst, "daily")));
    settled.forEach((r, idx) => {
      const inst = slice[idx]!;
      if (r.status === "fulfilled") {
        if (r.value.status === "complete") invalidateDailyPlanCache(inst.userId);
        results.push({ instanceId: inst.id, status: r.value.status, cycleId: r.value.cycleId, reason: r.value.reason });
      } else {
        results.push({ instanceId: inst.id, status: "errored", reason: r.reason instanceof Error ? r.reason.message : String(r.reason) });
      }
    });
  }

  return NextResponse.json({ ranAt: new Date().toISOString(), count: instances.length, results });
}

export const GET = POST;
