import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { arcContracts } from "@/lib/db/schema";

export type ArcContractKey =
  | "portfolio_decisions"
  | "identity_registry"
  | "usdc"
  | "treasury_wallet"
  | "seed_wallet";

/**
 * Look up an Arc contract address from the global registry. Single
 * Postgres roundtrip per call; no in-memory cache so admin updates via
 * /api/admin/arc-contracts propagate immediately across all Vercel
 * function instances. The registry is two rows -- query cost is sub-ms.
 *
 * Throws when a key is not registered so the caller surfaces a clear
 * error instead of silently anchoring to address(0).
 */
export async function getArcContract(key: ArcContractKey): Promise<string> {
  const [row] = await db.select({ address: arcContracts.address })
    .from(arcContracts).where(eq(arcContracts.key, key)).limit(1);
  if (!row) {
    throw new Error(
      `[arc-contracts] '${key}' not registered. POST /api/admin/arc-contracts to set it.`,
    );
  }
  return row.address;
}

/**
 * Same as getArcContract but returns null (with a console.warn) instead
 * of throwing. Use this on fire-and-forget paths where a missing address
 * should skip the anchor, not break the parent operation (e.g. a trade
 * close shouldn't fail because the registry is empty in dev).
 */
export async function getArcContractOrSkip(key: ArcContractKey): Promise<string | null> {
  try {
    return await getArcContract(key);
  } catch (err) {
    console.warn(`[arc-contracts] skipping: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

/**
 * Look up an entry with both its EVM address and the Circle wallet id we
 * control. Only entries we transmit FROM (e.g. seed_wallet) have a wallet
 * id. Returns null on either missing row or missing wallet id so callers
 * can degrade gracefully when the operator hasn't seeded the entry yet.
 */
export async function getArcWallet(
  key: ArcContractKey,
): Promise<{ address: string; walletId: string } | null> {
  const [row] = await db.select({ address: arcContracts.address, walletId: arcContracts.walletId })
    .from(arcContracts).where(eq(arcContracts.key, key)).limit(1);
  if (!row || !row.walletId) return null;
  return { address: row.address, walletId: row.walletId };
}
