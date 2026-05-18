import "server-only";

import type { Blockchain } from "@circle-fin/developer-controlled-wallets";
import { circleDeveloperSdk } from "@/lib/utils/developer-controlled-wallets-client";
import { db } from "@/lib/db/client";
import { selboInstances, type SelboInstance } from "@/lib/db/schema/selbo-instances";
import { user } from "@/lib/db/schema/auth";
import { registerSelboAgentForInstance } from "@/lib/arc/register-erc8004.service";
import { fundNewUserWallet } from "@/lib/arc/seed-wallet.service";
import { sendWaitlistConfirmation } from "@/lib/email/send-waitlist-confirmation";
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
        // Pause-by-default: new users must explicitly enable Selbo from
        // the navbar status pill. Their first daily plan fires on the
        // first resume. Existing users with this row already set to
        // false stay enabled.
        killSwitchActive: true,
      })
      .returning();
    if (!row) throw new Error("selbo_instances insert returned no row");
    // Fire-and-forget ERC-8004 registration: mints the user's permanent
    // agent identity on Arc using their own Circle wallet. Failures leave
    // erc8004TokenId null and are logged; backfill can retry.
    registerSelboAgentForInstance({
      instanceId: row.id, walletId: row.circleWalletId, walletAddress: row.circleWalletAddress,
    }).catch((err) => console.error("[selbo-instance] erc8004:", err));
    // Fire-and-forget: seed the new user's wallet with $1000 testnet USDC
    // from the operator-managed seed_wallet entry in arc_contracts.
    // Skips silently if seed_wallet hasn't been registered yet.
    fundNewUserWallet({ userWalletAddress: row.circleWalletAddress })
      .catch((err) => console.error("[selbo-instance] seed funding:", err));
    // Fire-and-forget waitlist confirmation email when the beta gate is
    // active (BETA_CODE set). Skips when beta is open (auto-granted).
    if (!betaOpen) {
      db.select({ email: user.email, name: user.name }).from(user)
        .where(eq(user.id, userId)).limit(1)
        .then(([u]) => u && sendWaitlistConfirmation(u.email, u.name))
        .catch((err) => console.error("[selbo-instance] waitlist email:", err));
    }
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
