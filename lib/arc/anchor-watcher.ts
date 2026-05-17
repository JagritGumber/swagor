import { getSdk, sha256Hex, uuidToBytes32, ZERO_BYTES32, type AnchorJsonValue } from "./sdk";
import { getArcContractOrSkip } from "./contracts";

export type WatcherAnchorInput = {
  walletId: string;
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
 * Anchor a watcher decision from the user's Circle wallet. Fires for
 * `execute` and `risk_emergency` only; `hold` is too noisy and
 * `deliberate` is anchored via the swarm cycle path.
 */
export async function anchorWatcherDecision(
  input: WatcherAnchorInput,
): Promise<WatcherAnchorResult | null> {
  const contractAddress = await getArcContractOrSkip("portfolio_decisions");
  if (!contractAddress) return null;

  const tickIdBytes32 = uuidToBytes32(input.monitorTickId);
  const traceHash = sha256Hex(input.contextDigest);
  const tag = `watcher:${input.verdict}`;
  const verdict = input.rationale.slice(0, 120);

  const resp = await getSdk().createContractExecutionTransaction({
    walletId: input.walletId,
    contractAddress,
    abiFunctionSignature: "anchorDecision(bytes32,bytes32,bytes32,string,string)",
    abiParameters: [tickIdBytes32, ZERO_BYTES32, traceHash, tag, verdict],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });

  return { txId: resp.data?.id ?? "", contractAddress, tickIdBytes32, traceHash };
}
