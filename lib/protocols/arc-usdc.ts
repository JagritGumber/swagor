import { createPublicClient, http, formatUnits } from "viem";
import { arcTestnet } from "@/lib/web3/chains";

/**
 * Read the user's native USDC balance on Arc Testnet.
 * On Arc, USDC is the native gas token; standard `getBalance` returns USDC
 * in 18-decimal units.
 */
const client = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

export type PositionSnapshot = {
  protocol: "wallet";
  chain: string;
  asset: string;
  amount: string;
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
