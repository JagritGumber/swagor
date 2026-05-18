import "server-only";
import { getSdk } from "./sdk";
import { getArcContractOrSkip, getArcWallet } from "./contracts";

/** Each new Selbo wallet is seeded with this much testnet USDC. */
export const NEW_USER_SEED_USD = 1000;

/**
 * Fund a freshly-created user wallet with testnet USDC from the
 * operator-managed seed_wallet entry in arc_contracts. Fire-and-forget
 * from ensureSelboInstance: failures are logged and leave the wallet
 * empty so a future backfill can retry.
 *
 * Skips silently when seed_wallet or usdc is missing from arc_contracts
 * (dev mode before the operator runs the one-time admin POST).
 */
export async function fundNewUserWallet(input: {
  userWalletAddress: string;
  amountUsd?: number;
}): Promise<{ circleTxId: string } | null> {
  const usdc = await getArcContractOrSkip("usdc");
  const seed = await getArcWallet("seed_wallet");
  if (!usdc || !seed) {
    console.warn("[seed-wallet] usdc or seed_wallet not registered; skipping new-user funding");
    return null;
  }

  const amount = input.amountUsd ?? NEW_USER_SEED_USD;
  const sixDecimals = BigInt(Math.round(amount * 1_000_000)).toString();

  const resp = await getSdk().createTransaction({
    walletId: seed.walletId,
    tokenAddress: usdc,
    destinationAddress: input.userWalletAddress,
    amount: [sixDecimals],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });
  const circleTxId = resp.data?.id;
  if (!circleTxId) {
    console.error("[seed-wallet] Circle returned no tx id");
    return null;
  }
  console.log(`[seed-wallet] funded ${input.userWalletAddress} with ${amount} USDC (tx ${circleTxId})`);
  return { circleTxId };
}
