import { createHash } from "node:crypto";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

let sdk: ReturnType<typeof initiateDeveloperControlledWalletsClient> | null = null;

function getSdk() {
  if (sdk) return sdk;
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  if (!apiKey || !entitySecret) throw new Error("Circle credentials not set in env");
  sdk = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
  return sdk;
}

function uuidToBytes32(uuid: string): `0x${string}` {
  // UUIDv4 is 16 bytes; pad to bytes32 (32 bytes) by left-prefixing zeros.
  const hex = uuid.replace(/-/g, "").padStart(64, "0");
  return `0x${hex}`;
}

export function sha256Hex(data: unknown): `0x${string}` {
  const json = JSON.stringify(data);
  const hash = createHash("sha256").update(json).digest("hex");
  return `0x${hash}`;
}

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
 * Non-blocking: Circle queues the tx and returns immediately. The on-chain
 * confirmation lands ~1-2 sec later. We save the Circle tx id; the on-chain
 * hash can be fetched later by polling Circle for state=COMPLETE.
 *
 * If the anchor contract isn't deployed yet (no env var), logs a warning
 * and returns null so the cycle pipeline continues.
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
