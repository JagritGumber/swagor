import { createPublicClient, http, formatUnits } from "viem";
import { arcTestnet } from "@/lib/web3/chains";

/**
 * Read the user's native USDC balance on Arc Testnet.
 * On Arc, USDC is the native gas token (system contract address
 * 0x3600...). Standard `getBalance` returns USDC in 18-decimal units.
 *
 * For the hackathon scope this is the "positions" data the agent reasons
 * over. In production this expands to per-protocol reads
 * (Aave aTokens, Compound v3, Pendle PT/YT, etc.) on the chains where
 * those protocols are deployed.
 */
const client = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

export type PositionSnapshot = {
  protocol: "wallet" | "aave" | "compound" | "pendle" | "dsr" | "usyc";
  chain: string;
  asset: string;
  amount: string; // human-readable, decimal string
  amountWei: string;
  decimals: number;
};

export async function getArcUsdcBalance(
  address: `0x${string}`,
): Promise<PositionSnapshot> {
  const balanceWei = await client.getBalance({ address });
  return {
    protocol: "wallet",
    chain: "Arc Testnet",
    asset: "USDC",
    amount: formatUnits(balanceWei, 18),
    amountWei: balanceWei.toString(),
    decimals: 18,
  };
}
