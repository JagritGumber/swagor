import { db } from "@/lib/db/client";
import { judgmentTicks, selboInstances } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import {
  getOrCreateEngine,
  getEngineEntry,
  updateLastJudgment,
} from "./judgment-engine-manager";
import { loadCandlesForAsset } from "./candle-loader";

type JudgmentResult = {
  judgmentId: string;
  side: string | null;
  confidence: number;
  reason: string;
  allJudgments: Array<{
    configId: string;
    label: string;
    confidence: number;
    reason: string;
  }>;
  metricsSnapshot: Record<string, unknown>;
};

async function persistJudgment(params: {
  instanceId: string;
  asset: string;
  result: { judgment: { id: string; reason: string; invalidation: string | null; action: { type: string; side?: string; confidence?: number; entry?: number; stop?: number; target?: number }; metrics: Record<string, unknown> }; allJudgments: Array<{ configId: string; label: string; confidence: number; reason: string }> };
  previousJudgmentId: string | null;
  adminJudgment: boolean;
}): Promise<JudgmentResult> {
  const { instanceId, asset, result, previousJudgmentId, adminJudgment } = params;
  const { judgment, allJudgments } = result;

  const record = await db
    .insert(judgmentTicks)
    .values({
      selboInstanceId: instanceId,
      asset,
      version: "v1",
      side:
        judgment.action.type === "enter"
          ? (judgment.action.side ?? null)
          : null,
      confidence: judgment.action.type === "enter"
        ? (judgment.action.confidence ?? 0)
        : 0,
      reason: judgment.reason,
      entryPrice:
        judgment.action.type === "enter"
          ? String(judgment.action.entry)
          : null,
      stopPrice:
        judgment.action.type === "enter"
          ? String(judgment.action.stop)
          : null,
      targetPrice:
        judgment.action.type === "enter"
          ? String(judgment.action.target)
          : null,
      invalidation: judgment.invalidation,
      allJudgments: allJudgments.map((j) => ({
        configId: j.configId,
        label: j.label,
        confidence: j.confidence,
        reason: j.reason,
      })),
      metricsSnapshot: judgment.metrics as unknown as Record<string, unknown>,
      previousJudgmentId,
      adminJudgment,
    })
    .returning({ id: judgmentTicks.id });

  const savedId = record[0]?.id;
  if (savedId) {
    updateLastJudgment(instanceId, savedId);
  }

  return {
    judgmentId: savedId ?? judgment.id,
    side:
      judgment.action.type === "enter"
        ? (judgment.action.side ?? null)
        : null,
    confidence: judgment.action.type === "enter"
      ? (judgment.action.confidence ?? 0)
      : 0,
    reason: judgment.reason,
    allJudgments: allJudgments.map((j) => ({
      configId: j.configId,
      label: j.label,
      confidence: j.confidence,
      reason: j.reason,
    })),
    metricsSnapshot: judgment.metrics as unknown as Record<string, unknown>,
  };
}

export async function runJudgmentForInstance(
  instanceId: string,
): Promise<JudgmentResult> {
  const [instance] = await db
    .select()
    .from(selboInstances)
    .where(eq(selboInstances.id, instanceId))
    .limit(1);

  if (!instance) throw new Error(`Selbo instance ${instanceId} not found`);
  if (!instance.betaAccessGranted) {
    throw new Error(`Instance ${instanceId} lacks beta access`);
  }
  if (instance.killSwitchActive) {
    throw new Error(`Instance ${instanceId} has kill switch active`);
  }

  const asset = (instance.currentlyWatching as string[])?.[0] ?? "ETH";
  const candles = await loadCandlesForAsset(asset, 300, "1h");
  if (candles.length === 0) {
    throw new Error(`No candles available for ${asset}`);
  }

  const engine = await getOrCreateEngine(instanceId, asset, candles);
  const entry = getEngineEntry(instanceId);

  const result = engine.onCandle(candles[candles.length - 1]);

  return persistJudgment({
    instanceId,
    asset,
    result,
    previousJudgmentId: entry?.previousJudgmentId ?? null,
    adminJudgment: false,
  });
}

export async function runAdminJudgment(
  asset: string,
): Promise<JudgmentResult> {
  const ADMIN_INSTANCE_ID = "admin-judge-zero";
  const candles = await loadCandlesForAsset(asset, 300, "1h");
  if (candles.length === 0) {
    throw new Error(`No candles available for admin judgment: ${asset}`);
  }

  const engine = await getOrCreateEngine(ADMIN_INSTANCE_ID, asset, candles);
  const entry = getEngineEntry(ADMIN_INSTANCE_ID);

  const result = engine.onCandle(candles[candles.length - 1]);

  return persistJudgment({
    instanceId: ADMIN_INSTANCE_ID,
    asset,
    result,
    previousJudgmentId: entry?.previousJudgmentId ?? null,
    adminJudgment: true,
  });
}

export async function getLatestJudgment(
  instanceId: string,
): Promise<Record<string, unknown> | null> {
  const [latest] = await db
    .select()
    .from(judgmentTicks)
    .where(eq(judgmentTicks.selboInstanceId, instanceId))
    .orderBy(desc(judgmentTicks.createdAt))
    .limit(1);

  return latest ?? null;
}

export async function getLatestAdminJudgment(
  asset: string,
): Promise<Record<string, unknown> | null> {
  const [latest] = await db
    .select()
    .from(judgmentTicks)
    .where(
      and(
        eq(judgmentTicks.adminJudgment, true),
        eq(judgmentTicks.asset, asset),
      ),
    )
    .orderBy(desc(judgmentTicks.createdAt))
    .limit(1);

  return latest ?? null;
}

export async function getJudgmentHistory(
  instanceId: string,
  limit: number = 50,
): Promise<Record<string, unknown>[]> {
  return db
    .select()
    .from(judgmentTicks)
    .where(eq(judgmentTicks.selboInstanceId, instanceId))
    .orderBy(desc(judgmentTicks.createdAt))
    .limit(limit);
}
