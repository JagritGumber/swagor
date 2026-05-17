import { getSdk, sha256Hex, uuidToBytes32, ZERO_BYTES32, type AnchorJsonValue } from "./sdk";

export type WatcherAnchorInput = {
  monitorTickId: string;
  verdict: "execute" | "risk_emergency";
  rationale: string;
  contextDigest: AnchorJsonValue;
};

export type WatcherAnchorResult = {
  txId: string;
  contractAddress: string;
  tickIdBytes32: string;
  traceHash: string;
};

/**
 * Anchor a watcher decision on Arc. Fires for `execute` and `risk_emergency`
 * verdicts only. `hold` is not anchored (too noisy); `deliberate` is anchored
 * via the swarm cycle path. Rationale truncated to 120 chars for the on-chain
 * verdict string; full context is hashed.
 */
export async function anchorWatcherDecision(
  input: WatcherAnchorInput,
): Promise<WatcherAnchorResult | null> {
  const contractAddress = process.env.NEXT_PUBLIC_ANCHOR_CONTRACT_ADDRESS;
  const walletId = process.env.NEXT_PUBLIC_AGENT_WALLET_ID;
  if (!contractAddress || !walletId) {
    console.warn("[anchor] env missing; skipping watcher anchor");
    return null;
  }

  const tickIdBytes32 = uuidToBytes32(input.monitorTickId);
  const traceHash = sha256Hex(input.contextDigest);
  const tag = `watcher:${input.verdict}`;
  const verdict = input.rationale.slice(0, 120);

  const resp = await getSdk().createContractExecutionTransaction({
    walletId,
    contractAddress,
    abiFunctionSignature: "anchorDecision(bytes32,bytes32,bytes32,string,string)",
    abiParameters: [tickIdBytes32, ZERO_BYTES32, traceHash, tag, verdict],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });

  return { txId: resp.data?.id ?? "", contractAddress, tickIdBytes32, traceHash };
}
