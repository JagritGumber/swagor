import "server-only";

import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { dailyPlans, rebalanceCycles, type SelboInstance } from "@/lib/db/schema";
import { isLlmBudgetExhausted } from "./cost-cap.service";
import { buildDailyPlanContext } from "./daily-planner-context";
import { runSwarm } from "./swarm-runner.service";
import { aggregateDailyPlan } from "./daily-aggregator.service";
import { compileDailyPlan } from "./plan-compiler.service";

const SWARM_SIZE = 16;
const RATE_LIMIT_MAX_CYCLES_24H = 3;
const RATE_LIMIT_MIN_COOLDOWN_HOURS = 4;
const UTC_DAY_START = sql`date_trunc('day', now() AT TIME ZONE 'UTC')`;

type RunResult = { cycleId: string; status: "complete" | "failed" | "skipped"; reason?: string };

async function rateLimitBlocked(instanceId: string): Promise<string | null> {
  const rows = await db.select({ startedAt: rebalanceCycles.startedAt })
    .from(rebalanceCycles)
    .where(and(eq(rebalanceCycles.selboInstanceId, instanceId),
      gte(rebalanceCycles.startedAt, sql`now() - interval '24 hours'` as unknown as Date)));
  if (rows.length >= RATE_LIMIT_MAX_CYCLES_24H) return "rate_limit_24h_cap";
  const latest = rows.reduce<Date | null>((acc, r) => acc && acc > r.startedAt ? acc : r.startedAt, null);
  if (latest && Date.now() - latest.getTime() < RATE_LIMIT_MIN_COOLDOWN_HOURS * 3_600_000) return "rate_limit_cooldown";
  return null;
}

async function existingDailyPlan(instanceId: string): Promise<string | null> {
  // Only `complete` rows count as "already ran today". A failed row from
  // an earlier attempt MUST allow the 00:30 UTC retry path to regenerate.
  const [row] = await db.select({ cycleId: dailyPlans.cycleId }).from(dailyPlans)
    .where(and(eq(dailyPlans.selboInstanceId, instanceId),
      eq(dailyPlans.status, "complete"),
      gte(dailyPlans.generatedAt, UTC_DAY_START as unknown as Date)));
  return row?.cycleId ?? null;
}

/**
 * Run a daily-plan swarm cycle for one Selbo instance. Orchestrates
 * cost-cap, idempotency, rate-limit, swarm, aggregator, plan-compiler, and
 * persistence. Scheduled (`triggeredBy='daily'`) writes a daily_plans row;
 * watcher-triggered runs only write to rebalance_cycles for the dev panel.
 */
export async function runDailyPlanForInstance(
  instance: SelboInstance,
  triggeredBy: "daily" | "watcher",
): Promise<RunResult> {
  if (await isLlmBudgetExhausted()) return { cycleId: "", status: "skipped", reason: "daily_cost_cap_exceeded" };

  if (triggeredBy === "daily") {
    const existing = await existingDailyPlan(instance.id);
    if (existing) return { cycleId: existing, status: "skipped", reason: "already_ran_today" };
  } else {
    const blocked = await rateLimitBlocked(instance.id);
    if (blocked) return { cycleId: "", status: "skipped", reason: blocked };
  }

  const [cycle] = await db.insert(rebalanceCycles).values({
    selboInstanceId: instance.id,
    triggeredBy,
    status: "running",
  }).returning({ id: rebalanceCycles.id });
  const cycleId = cycle.id;

  try {
    const context = await buildDailyPlanContext(instance);
    // Persist the swarm context for the dev panel BEFORE we kick off
    // LLM calls so even a failed cycle has a verifiable input record.
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

    if (triggeredBy === "daily") {
      await db.insert(dailyPlans).values({
        userId: instance.userId, selboInstanceId: instance.id, cycleId,
        status: "complete", planMarkdown: compiled.markdown, planJson: compiled as object,
      });
    }
    return { cycleId, status: "complete" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.update(rebalanceCycles).set({ status: "failed", errorMessage: msg, completedAt: new Date() })
      .where(eq(rebalanceCycles.id, cycleId));
    if (triggeredBy === "daily") {
      await db.insert(dailyPlans).values({
        userId: instance.userId, selboInstanceId: instance.id, cycleId,
        status: "failed", errorMessage: msg,
      });
    }
    console.error(`[daily-planner] cycle ${cycleId} failed:`, msg);
    return { cycleId, status: "failed", reason: msg };
  }
}
