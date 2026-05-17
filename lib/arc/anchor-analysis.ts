import "server-only";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { dailyPlans } from "@/lib/db/schema";
import { getSdk, sha256Hex, uuidToBytes32, ZERO_BYTES32 } from "./sdk";
import { registerAnchorSource } from "./poll-pending-anchors";

export type DailyAnalysisAnchorInput = {
  planId: string;
  generatedAt: Date;
  planJson: unknown;
  verdict: string;
  kind: "live" | "backtest";
  backtestRunId?: string;
};

export type DailyAnalysisAnchorResult = {
  txId: string;
  contractAddress: string;
  planIdBytes32: string;
  reasoningHash: string;
};

/**
 * Anchor a single daily analysis (live or backtest) on Arc via the existing
 * PortfolioDecisions.anchorDecision ABI:
 *   cycleId          -> planId (bytes32-padded)
 *   graphSnapshotHash-> zero bytes32 (unused for analyses)
 *   swarmTraceHash   -> sha256(planJson)
 *   ipfsCid (string) -> "analysis:YYYY-MM-DD" or "backtest:RUNID8:YYYY-MM-DD"
 *   verdict (string) -> short summary truncated to 120 chars
 * Fire-and-forget from the caller; null when env vars are unset (dev mode).
 */
export async function anchorDailyAnalysis(
  input: DailyAnalysisAnchorInput,
): Promise<DailyAnalysisAnchorResult | null> {
  const contractAddress = process.env.NEXT_PUBLIC_ANCHOR_CONTRACT_ADDRESS;
  const walletId = process.env.NEXT_PUBLIC_AGENT_WALLET_ID;
  if (!contractAddress || !walletId) {
    console.warn("[anchor] env missing; skipping daily-analysis anchor");
    return null;
  }

  const planIdBytes32 = uuidToBytes32(input.planId);
  const reasoningHash = sha256Hex(input.planJson);
  const dateStr = input.generatedAt.toISOString().slice(0, 10);
  const tag = input.kind === "backtest" && input.backtestRunId
    ? `backtest:${input.backtestRunId.slice(0, 8)}:${dateStr}`
    : `analysis:${dateStr}`;
  const verdict = input.verdict.slice(0, 120);

  const resp = await getSdk().createContractExecutionTransaction({
    walletId,
    contractAddress,
    abiFunctionSignature: "anchorDecision(bytes32,bytes32,bytes32,string,string)",
    abiParameters: [planIdBytes32, ZERO_BYTES32, reasoningHash, tag, verdict],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });

  return { txId: resp.data?.id ?? "", contractAddress, planIdBytes32, reasoningHash };
}

/**
 * Caller-facing fire-and-forget wrapper. Builds a short verdict from the
 * compiled plan, anchors, and stamps the Circle tx id back onto the
 * daily_plans row. Errors are logged; never thrown. Callers do:
 *   fireDailyPlanAnchor({...}).catch(() => {})
 */
export async function fireDailyPlanAnchor(opts: {
  planId: string; generatedAt: Date;
  compiled: { markdown?: string };
  kind: "live" | "backtest"; backtestRunId?: string;
}): Promise<void> {
  const verdict = (opts.compiled.markdown ?? "").split("\n").find((l) => l.trim())?.slice(0, 120)
    ?? (opts.kind === "backtest" ? "backtest plan" : "live daily plan");
  const result = await anchorDailyAnalysis({
    planId: opts.planId, generatedAt: opts.generatedAt, planJson: opts.compiled,
    verdict, kind: opts.kind, backtestRunId: opts.backtestRunId,
  });
  if (result?.txId) {
    await db.update(dailyPlans).set({ arcAnchorTx: result.txId })
      .where(eq(dailyPlans.id, opts.planId));
  }
}

// Module-load side-effect: register daily_plans as a poller source so the
// heartbeat in /api/watcher/tick backfills on-chain hashes for queued anchors.
registerAnchorSource({
  name: "daily-plans",
  fetchPending: () =>
    db.select({ id: dailyPlans.id, txId: dailyPlans.arcAnchorTx })
      .from(dailyPlans)
      .where(and(isNotNull(dailyPlans.arcAnchorTx), isNull(dailyPlans.arcOnchainTxHash)))
      .orderBy(asc(dailyPlans.generatedAt))
      .limit(20),
  setOnchain: (id, v) =>
    db.update(dailyPlans).set({ arcOnchainTxHash: v }).where(eq(dailyPlans.id, id)),
});
