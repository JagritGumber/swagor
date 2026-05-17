import { getSdk, sha256Hex, uuidToBytes32 } from "./sdk";

export type AnchorResult = {
  txId: string;
  contractAddress: string;
  cycleIdBytes32: string;
  swarmTraceHash: string;
  graphSnapshotHash: string;
};

/**
 * Anchor a cycle's decision on Arc by calling PortfolioDecisions.anchorDecision
 * via Circle's Developer-Controlled Wallets SDK.
 *
 * Non-blocking: Circle queues the tx and returns immediately. On-chain
 * confirmation lands ~1-2s later; the hash is backfilled by the poller.
 * Returns null when the contract or wallet env vars are unset so the cycle
 * pipeline continues in dev mode.
 */
export async function anchorCycle(opts: {
  cycleId: string;
  cycleState: unknown;
  verdict: string;
}): Promise<AnchorResult | null> {
  const contractAddress = process.env.NEXT_PUBLIC_ANCHOR_CONTRACT_ADDRESS;
  const walletId = process.env.NEXT_PUBLIC_AGENT_WALLET_ID;

  if (!contractAddress) {
    console.warn(
      "[anchor] NEXT_PUBLIC_ANCHOR_CONTRACT_ADDRESS not set; skipping. Run: node deploy-anchor-contract.mjs",
    );
    return null;
  }
  if (!walletId) {
    console.warn("[anchor] NEXT_PUBLIC_AGENT_WALLET_ID not set; skipping");
    return null;
  }

  const cycleIdBytes32 = uuidToBytes32(opts.cycleId);
  const swarmTraceHash = sha256Hex(opts.cycleState);
  const graphSnapshotHash = sha256Hex({ note: "no graph in hackathon scope" });

  const resp = await getSdk().createContractExecutionTransaction({
    walletId,
    contractAddress,
    abiFunctionSignature: "anchorDecision(bytes32,bytes32,bytes32,string,string)",
    abiParameters: [cycleIdBytes32, graphSnapshotHash, swarmTraceHash, "", opts.verdict],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });

  return {
    txId: resp.data?.id ?? "",
    contractAddress,
    cycleIdBytes32,
    swarmTraceHash,
    graphSnapshotHash,
  };
}
