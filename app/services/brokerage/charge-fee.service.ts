import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { brokerFees } from "@/lib/db/schema";
import { getSdk } from "@/lib/arc/sdk";
import { getArcContractOrSkip } from "@/lib/arc/contracts";

const MAX_FEE_USD = 0.10;
const FEE_BPS = 200; // 2.00%

/**
 * Per-trade brokerage fee = min($0.10, sizeUsd * 2%) rounded to 6 USDC
 * decimals. Idempotent via the unique index on broker_fees.trade_id:
 * the INSERT ... ON CONFLICT DO NOTHING returns no row when a fee
 * already exists, in which case we short-circuit without queuing a
 * second Circle transfer.
 *
 * Fire-and-forget from closePaperTrade. Skips silently when the USDC
 * or treasury_wallet rows are missing from arc_contracts (dev mode
 * before the operator runs the one-time admin POST).
 */
export async function chargeBrokerFee(input: {
  userId: string;
  walletId: string;
  tradeId: string;
  sizeUsd: number;
  pnlUsd: number | null;
}): Promise<void> {
  const fee = Math.min(MAX_FEE_USD, (input.sizeUsd * FEE_BPS) / 10000);
  if (!(fee > 0)) return;
  const feeStr = fee.toFixed(6);

  const inserted = await db.insert(brokerFees).values({
    userId: input.userId,
    tradeId: input.tradeId,
    feeUsd: feeStr,
    pnlUsdAtClose: input.pnlUsd !== null ? input.pnlUsd.toString() : null,
  }).onConflictDoNothing({ target: brokerFees.tradeId })
    .returning({ id: brokerFees.id });
  const row = inserted[0];
  if (!row) {
    console.log(`[broker-fee] trade ${input.tradeId} already charged; skipping`);
    return;
  }

  const usdc = await getArcContractOrSkip("usdc");
  const treasury = await getArcContractOrSkip("treasury_wallet");
  if (!usdc || !treasury) return;

  const amountSixDecimals = BigInt(Math.round(fee * 1_000_000)).toString();
  const resp = await getSdk().createTransaction({
    walletId: input.walletId,
    tokenAddress: usdc,
    destinationAddress: treasury,
    amount: [amountSixDecimals],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });
  const circleTxId = resp.data?.id;
  if (circleTxId) {
    await db.update(brokerFees).set({ circleTxId })
      .where(eq(brokerFees.id, row.id));
  }
}
