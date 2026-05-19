import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { dailyPlans, rebalanceCycles, type SelboInstance } from "@/lib/db/schema";
import { fireDailyPlanAnchor } from "@/lib/arc/anchor-analysis";
import { isLlmBudgetExhausted } from "./cost-cap.service";
import { buildDailyPlanContext, externalSwarmContext } from "./daily-planner-context";
import { runSwarm } from "./swarm-runner.service";
import { aggregateDailyPlan } from "./daily-aggregator.service";
import { compileDailyPlan } from "./plan-compiler.service";
import type { ThesisMemory } from "./build-thesis-memory";
import { checkIngestionAbort, existingDailyPlan, rateLimitBlocked } from "./daily-planner-checks";

const SWARM_SIZE = 6;
const EMPTY_THESIS_MEMORY: ThesisMemory = { active: [], recent: [] };

type RunResult = { cycleId: string; status: "complete" | "failed" | "skipped"; reason?: string };

async function writeFailedCycle(cycleId: string, instance: SelboInstance, triggeredBy: "daily" | "watcher", msg: string) {
  await db.update(rebalanceCycles).set({
    status: "failed", errorMessage: msg, completedAt: new Date(),
  }).where(eq(rebalanceCycles.id, cycleId));
  if (triggeredBy === "daily") {
    await db.insert(dailyPlans).values({
      userId: instance.userId, selboInstanceId: instance.id, cycleId,
      status: "failed", errorMessage: msg,
    });
  }
}

/** Run a daily-plan swarm cycle. `triggeredBy='daily'` writes a daily_plans row; watcher cycles only touch rebalance_cycles. Completed plans are anchored fire-and-forget. */
export async function runDailyPlanForInstance(
  instance: SelboInstance,
  triggeredBy: "daily" | "watcher",
  opts?: { force?: boolean },
): Promise<RunResult> {
  if (await isLlmBudgetExhausted(instance.id)) return { cycleId: "", status: "skipped", reason: "daily_cost_cap_exceeded" };

  if (triggeredBy === "daily") {
    if (!opts?.force) {
      const existing = await existingDailyPlan(instance.id);
      if (existing) return { cycleId: existing, status: "skipped", reason: "already_ran_today" };
    }
  } else {
    const blocked = await rateLimitBlocked(instance.id);
    if (blocked) return { cycleId: "", status: "skipped", reason: blocked };
  }

  const [cycle] = await db.insert(rebalanceCycles).values({
    selboInstanceId: instance.id, triggeredBy, status: "running",
  }).returning({ id: rebalanceCycles.id });
  const cycleId = cycle.id;

  try {
    const context = await buildDailyPlanContext(instance);
    await db.update(rebalanceCycles).set({ cycleState: context as object })
      .where(eq(rebalanceCycles.id, cycleId));

    if (!opts?.force) {
      const reason = checkIngestionAbort(context._ingestion, context.marketFeatures.symbols.length);
      if (reason) {
        await writeFailedCycle(cycleId, instance, triggeredBy, `ingestion: ${reason}`);
        return { cycleId, status: "failed", reason: `ingestion_${reason}` };
      }
    }

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

    if (triggeredBy === "daily") {
      const [plan] = await db.insert(dailyPlans).values({
        userId: instance.userId, selboInstanceId: instance.id, cycleId,
        status: "complete", planMarkdown: compiled.markdown, planJson: compiled as object,
      }).returning({ id: dailyPlans.id, generatedAt: dailyPlans.generatedAt });
      fireDailyPlanAnchor({
        walletId: instance.circleWalletId, planId: plan.id, generatedAt: plan.generatedAt,
        compiled, kind: "live",
      }).catch((err) => console.error("[daily-planner] anchor:", err));
    }
    return { cycleId, status: "complete" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await writeFailedCycle(cycleId, instance, triggeredBy, msg);
    console.error(`[daily-planner] cycle ${cycleId} failed:`, msg);
    return { cycleId, status: "failed", reason: msg };
  }
}
