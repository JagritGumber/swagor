import "server-only";
import { eq } from "drizzle-orm";
import { createPublicClient, http, parseAbiItem } from "viem";
import { db } from "@/lib/db/client";
import { selboInstances } from "@/lib/db/schema";
import { getSdk } from "./sdk";
import { getArcContract } from "./contracts";

const ARC_TESTNET_CHAIN = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
} as const;
const TERMINAL_FAIL = new Set(["FAILED", "CANCELLED", "DENIED"]);

/**
 * Register a Selbo instance as an ERC-8004 AI agent on Arc Testnet using the
 * user's own Circle Dev Wallet (not a shared operator wallet). One NFT minted
 * per Selbo instance; the tokenId is the user's permanent agent identity.
 * Fire-and-forget from ensureSelboInstance: failures are logged and leave the
 * row's erc8004 columns null so a future backfill can retry.
 */
export async function registerSelboAgentForInstance(input: {
  instanceId: string;
  walletId: string;
  walletAddress: string;
}): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) { console.warn("[erc8004] NEXT_PUBLIC_SITE_URL not set; skipping"); return; }
  const metadataUri = `${siteUrl}/selbo-agent.json`;
  const identityRegistry = await getArcContract("identity_registry");

  const tx = await getSdk().createContractExecutionTransaction({
    walletId: input.walletId,
    contractAddress: identityRegistry,
    abiFunctionSignature: "register(string)",
    abiParameters: [metadataUri],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });
  const circleTxId = tx.data?.id;
  if (!circleTxId) throw new Error("[erc8004] Circle returned no tx id");

  let onchainHash: string | null = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const r = await getSdk().getTransaction({ id: circleTxId });
    const state = r.data?.transaction?.state;
    if (state === "COMPLETE") { onchainHash = r.data?.transaction?.txHash ?? null; break; }
    if (state && TERMINAL_FAIL.has(state)) throw new Error(`[erc8004] tx ${state}`);
  }
  if (!onchainHash) throw new Error("[erc8004] polling timed out");

  const publicClient = createPublicClient({ chain: ARC_TESTNET_CHAIN, transport: http() });
  const latest = await publicClient.getBlockNumber();
  const fromBlock = latest > 10000n ? latest - 10000n : 0n;
  const logs = await publicClient.getLogs({
    address: identityRegistry as `0x${string}`,
    event: parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"),
    args: { to: input.walletAddress as `0x${string}` },
    fromBlock, toBlock: latest,
  });
  const tokenId = logs[logs.length - 1]?.args.tokenId?.toString();
  if (!tokenId) throw new Error("[erc8004] no Transfer event for wallet");

  await db.update(selboInstances)
    .set({ erc8004TokenId: tokenId, erc8004RegistrationTxHash: onchainHash })
    .where(eq(selboInstances.id, input.instanceId));
}
