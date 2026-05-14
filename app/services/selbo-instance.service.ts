import "server-only";

import type { Blockchain } from "@circle-fin/developer-controlled-wallets";
import { circleDeveloperSdk } from "@/lib/utils/developer-controlled-wallets-client";
import { db } from "@/lib/db/client";
import { selboInstances, type SelboInstance } from "@/lib/db/schema/selbo-instances";
import { eq } from "drizzle-orm";

// Circle SDK enum hasn't shipped a literal for the Arc testnet yet; runtime
// accepts the string, so we cast at the boundary.
const BLOCKCHAIN = "ARC-TESTNET" as Blockchain;

/**
 * Returns the user's Selbo instance, provisioning a Circle Developer-Controlled
 * Wallet on Arc Testnet on first call. Idempotent via the user_id UNIQUE
 * constraint: if a concurrent caller beats us to the insert, we re-fetch the
 * winner's row instead of throwing.
 *
 * Failure mode: if the Circle createWallet call succeeds but the row insert
 * fails for a non-unique reason, we leak the orphan wallet in Circle. Acceptable
 * for testnet scope; revisit when we wire real-money provisioning.
 */
export async function ensureSelboInstance(userId: string): Promise<SelboInstance> {
  const existing = await db
    .select()
    .from(selboInstances)
    .where(eq(selboInstances.userId, userId))
    .limit(1);
  if (existing[0]) return existing[0];

  const walletSet = await circleDeveloperSdk.createWalletSet({
    name: `selbo-${userId.slice(0, 8)}`,
  });
  const walletSetId = walletSet.data?.walletSet?.id;
  if (!walletSetId) throw new Error("Circle wallet set creation returned no id");

  const created = await circleDeveloperSdk.createWallets({
    accountType: "SCA",
    blockchains: [BLOCKCHAIN],
    walletSetId,
    count: 1,
  });
  const wallet = created.data?.wallets?.[0];
  if (!wallet) throw new Error("Circle wallet creation returned no wallet");

  // Private-beta default: gate on if BETA_CODE is set, auto-grant otherwise.
  const betaOpen = !process.env.BETA_CODE?.trim();

  try {
    const [row] = await db
      .insert(selboInstances)
      .values({
        userId,
        circleWalletId: wallet.id,
        circleWalletAddress: wallet.address.toLowerCase(),
        betaAccessGranted: betaOpen,
        betaGrantedAt: betaOpen ? new Date() : null,
      })
      .returning();
    return row;
  } catch {
    const refetch = await db
      .select()
      .from(selboInstances)
      .where(eq(selboInstances.userId, userId))
      .limit(1);
    if (refetch[0]) return refetch[0];
    throw new Error("Failed to persist selbo_instances row after Circle wallet provision");
  }
}
