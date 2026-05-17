import "server-only";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { dailyPlans } from "@/lib/db/schema";
import { getSdk, sha256Hex, uuidToBytes32, ZERO_BYTES32 } from "./sdk";
import { getArcContractOrSkip } from "./contracts";
import { registerAnchorSource } from "./poll-pending-anchors";

export type DailyAnalysisAnchorInput = {
  walletId: string;
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
 * Anchor a single daily analysis (live or backtest) on Arc from the
 * USER'S Circle wallet (walletId). Tag prefix distinguishes live vs
 * backtest. Returns null if the shared contract address env is unset.
 */
export async function anchorDailyAnalysis(
  input: DailyAnalysisAnchorInput,
): Promise<DailyAnalysisAnchorResult | null> {
  const contractAddress = await getArcContractOrSkip("portfolio_decisions");
  if (!contractAddress) return null;

  const planIdBytes32 = uuidToBytes32(input.planId);
  const reasoningHash = sha256Hex(input.planJson);
  const dateStr = input.generatedAt.toISOString().slice(0, 10);
  const tag = input.kind === "backtest" && input.backtestRunId
    ? `backtest:${input.backtestRunId.slice(0, 8)}:${dateStr}`
    : `analysis:${dateStr}`;
  const verdict = input.verdict.slice(0, 120);

  const resp = await getSdk().createContractExecutionTransaction({
    walletId: input.walletId,
    contractAddress,
    abiFunctionSignature: "anchorDecision(bytes32,bytes32,bytes32,string,string)",
    abiParameters: [planIdBytes32, ZERO_BYTES32, reasoningHash, tag, verdict],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });

  return { txId: resp.data?.id ?? "", contractAddress, planIdBytes32, reasoningHash };
}

/**
 * Fire-and-forget wrapper: builds a short verdict from the compiled plan,
 * anchors from the user's wallet, and stamps the Circle tx id back onto
 * the daily_plans row. Errors are logged; never thrown.
 */
export async function fireDailyPlanAnchor(opts: {
  walletId: string; planId: string; generatedAt: Date;
  compiled: { markdown?: string };
  kind: "live" | "backtest"; backtestRunId?: string;
}): Promise<void> {
  const verdict = (opts.compiled.markdown ?? "").split("\n").find((l) => l.trim())?.slice(0, 120)
    ?? (opts.kind === "backtest" ? "backtest plan" : "live daily plan");
  const result = await anchorDailyAnalysis({
    walletId: opts.walletId, planId: opts.planId, generatedAt: opts.generatedAt,
    planJson: opts.compiled, verdict, kind: opts.kind, backtestRunId: opts.backtestRunId,
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
