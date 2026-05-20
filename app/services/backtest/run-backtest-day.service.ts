import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { dailyPlans, rebalanceCycles, type SelboInstance } from "@/lib/db/schema";
import { buildHistoricalContext } from "./historical-context.service";
import { externalSwarmContext } from "@/app/services/swarm/daily-planner-context";
import { runSwarm } from "@/app/services/swarm/swarm-runner.service";
import { aggregateDailyPlan } from "@/app/services/swarm/daily-aggregator.service";
import { compileDailyPlan } from "@/app/services/swarm/plan-compiler.service";
import type { ThesisMemory } from "@/app/services/swarm/build-thesis-memory";

const SWARM_SIZE = 6;
const EMPTY_THESIS_MEMORY: ThesisMemory = { active: [], recent: [] };

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

  try {
    const context = await buildHistoricalContext(instance, asOf);
    await db.update(rebalanceCycles).set({ cycleState: context as object })
      .where(eq(rebalanceCycles.id, cycleId));

    const externalContext = externalSwarmContext(context);
    const decisions = await runSwarm({ cycleId, context: externalContext, size: SWARM_SIZE, mode: "daily_plan" });
    if (decisions.length === 0) throw new Error("swarm produced no usable decisions");

    const aggregator = await aggregateDailyPlan({ cycleId, decisions });
    const compiled = await compileDailyPlan({
      cycleId, aggregator, swarmContext: externalContext,
      strategyText: instance.strategyText, yesterdayPlanSummary: context.yesterdayPlanSummary,
      thesisMemory: EMPTY_THESIS_MEMORY,
    });

    await db.update(rebalanceCycles).set({ status: "completed", completedAt: new Date() })
      .where(eq(rebalanceCycles.id, cycleId));

    await db.insert(dailyPlans).values({
      userId: instance.userId, selboInstanceId: instance.id, cycleId,
      status: "complete", planMarkdown: compiled.markdown, planJson: compiled as object,
      backtestRunId, generatedAt: asOf,
    });
    // Backtests are deterministic replays over historical data, not
    // real-time decisions, so they are intentionally NOT anchored
    // on-chain: anchoring would spend gas on simulation noise and
    // pollute the track record. Only live cycles and live trades anchor.
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.update(rebalanceCycles).set({
      status: "failed",
      errorMessage: msg,
      completedAt: new Date(),
    }).where(eq(rebalanceCycles.id, cycleId));
    throw err;
  }
}
