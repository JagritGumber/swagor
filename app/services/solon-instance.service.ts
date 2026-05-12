import "server-only";

import { circleDeveloperSdk } from "@/lib/utils/developer-controlled-wallets-client";
import { db } from "@/lib/db/client";
import { solonInstances, type SolonInstance } from "@/lib/db/schema/solon-instances";
import { eq } from "drizzle-orm";

const BLOCKCHAIN = "ARC-TESTNET";

/**
 * Returns the user's Solon instance, provisioning a Circle Developer-Controlled
 * Wallet on Arc Testnet on first call. Idempotent via the user_id UNIQUE
 * constraint: if a concurrent caller beats us to the insert, we re-fetch the
 * winner's row instead of throwing.
 *
 * Failure mode: if the Circle createWallet call succeeds but the row insert
 * fails for a non-unique reason, we leak the orphan wallet in Circle. Acceptable
 * for testnet scope; revisit when we wire real-money provisioning.
 */
export async function ensureSolonInstance(userId: string): Promise<SolonInstance> {
  const existing = await db
    .select()
    .from(solonInstances)
    .where(eq(solonInstances.userId, userId))
    .limit(1);
  if (existing[0]) return existing[0];

  const walletSet = await circleDeveloperSdk.createWalletSet({
    name: `solon-${userId.slice(0, 8)}`,
  });
  const walletSetId = walletSet.data?.walletSet?.id;
  if (!walletSetId) throw new Error("Circle wallet set creation returned no id");

  const created = await circleDeveloperSdk.createWallets({
    accountType: "SCA",
    blockchains: [BLOCKCHAIN],
    walletSetId,
  });
  const wallet = created.data?.wallets?.[0];
  if (!wallet) throw new Error("Circle wallet creation returned no wallet");

  try {
    const [row] = await db
      .insert(solonInstances)
      .values({
        userId,
        circleWalletId: wallet.id,
        circleWalletAddress: wallet.address.toLowerCase(),
      })
      .returning();
    return row;
  } catch {
    const refetch = await db
      .select()
      .from(solonInstances)
      .where(eq(solonInstances.userId, userId))
      .limit(1);
    if (refetch[0]) return refetch[0];
    throw new Error("Failed to persist solon_instances row after Circle wallet provision");
  }
}
