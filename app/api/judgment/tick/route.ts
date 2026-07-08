import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { selboInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  runJudgmentForInstance,
  runAdminJudgment,
} from "@/app/services/judgment/judgment.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron heartbeat endpoint for judgment engine. Called by external scheduler
 * (cron-job.org) on candle close. Evaluates all active Selbo instances plus
 * the shared admin judgment engine.
 *
 * Auth: shared secret in Authorization: Bearer ${CRON_SECRET} header.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "CRON_SECRET not configured" },
        { status: 503 },
      );
    }
  } else {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();

  // Get all active instances (beta access granted, kill switch off)
  const activeInstances = await db
    .select()
    .from(selboInstances)
    .where(
      eq(selboInstances.killSwitchActive, false) &&
      eq(selboInstances.betaAccessGranted, true),
    );

  // Run judgment for each active instance
  const instanceResults = await Promise.allSettled(
    activeInstances.map((i) => runJudgmentForInstance(i.id)),
  );

  // Run admin judgment for ETH (primary asset)
  type AdminResult =
    | { status: "fulfilled"; value: { judgmentId: string; side: string | null } }
    | { status: "rejected"; reason: unknown };
  let adminResult: AdminResult;
  try {
    const adminJudgment = await runAdminJudgment("ETH");
    adminResult = { status: "fulfilled" as const, value: adminJudgment };
  } catch (e) {
    adminResult = { status: "rejected" as const, reason: e };
  }

  const summary = activeInstances.map((instance, idx) => {
    const r = instanceResults[idx];
    if (!r) return { instanceId: instance.id, status: "missing" as const };
    return {
      instanceId: instance.id,
      status: r.status,
      ...(r.status === "fulfilled"
        ? { judgmentId: r.value.judgmentId, side: r.value.side, confidence: r.value.confidence }
        : { error: r.reason instanceof Error ? r.reason.message : String(r.reason) }),
    };
  });

  return NextResponse.json({
    ranAt: now.toISOString(),
    instanceCount: activeInstances.length,
    results: summary,
    adminJudgment: {
      status: adminResult.status,
      ...(adminResult.status === "fulfilled"
        ? { judgmentId: adminResult.value.judgmentId, side: adminResult.value.side }
        : { error: adminResult.reason instanceof Error ? adminResult.reason.message : String(adminResult.reason) }),
    },
  });
}

// GET alias so manual curl works without -X POST during dev.
export const GET = POST;
