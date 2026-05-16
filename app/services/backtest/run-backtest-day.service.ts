import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { dailyPlans, rebalanceCycles, type SelboInstance } from "@/lib/db/schema";
import { buildHistoricalContext } from "./historical-context.service";
import { runSwarm } from "@/app/services/swarm/swarm-runner.service";
import { aggregateDailyPlan } from "@/app/services/swarm/daily-aggregator.service";
import { compileDailyPlan } from "@/app/services/swarm/plan-compiler.service";

const SWARM_SIZE = 16;

/**
 * Execute one backtest day end-to-end: insert cycle row tagged with
 * backtestRunId + asOf, build historical context, run swarm + aggregator
 * + plan-compiler, write the daily_plans row with generatedAt=asOf.
 * Skips every gate (cost cap, idempotency, ingestion abort) because
 * the caller (backtest harness) controls when this fires.
 */
export async function runBacktestDay(
  instance: SelboInstance, asOf: Date, backtestRunId: string,
): Promise<void> {
  const [cycle] = await db.insert(rebalanceCycles).values({
    selboInstanceId: instance.id, triggeredBy: "daily", status: "running",
    backtestRunId, asOf,
  }).returning({ id: rebalanceCycles.id });
  if (!cycle) throw new Error("cycle insert returned no row");
  const cycleId = cycle.id;

  const context = await buildHistoricalContext(instance, asOf);
  await db.update(rebalanceCycles).set({ cycleState: context as object })
    .where(eq(rebalanceCycles.id, cycleId));

  const decisions = await runSwarm({ cycleId, context, size: SWARM_SIZE, mode: "daily_plan" });
  if (decisions.length === 0) throw new Error("swarm produced no usable decisions");

  const aggregator = await aggregateDailyPlan({ cycleId, decisions });
  const compiled = await compileDailyPlan({
    cycleId, aggregator, swarmContext: context,
    strategyText: instance.strategyText, yesterdayPlanSummary: context.yesterdayPlanSummary,
  });

  await db.update(rebalanceCycles).set({ status: "completed", completedAt: new Date() })
    .where(eq(rebalanceCycles.id, cycleId));

  await db.insert(dailyPlans).values({
    userId: instance.userId, selboInstanceId: instance.id, cycleId,
    status: "complete", planMarkdown: compiled.markdown, planJson: compiled as object,
    backtestRunId, generatedAt: asOf,
  });
}
