import { getSdk, sha256Hex, uuidToBytes32, ZERO_BYTES32, type AnchorJsonValue } from "./sdk";

export type TradeAnchorResult = {
  txId: string;
  contractAddress: string;
  tradeIdBytes32: string;
  reasoningHash: string;
};

export type ClosedTradeAnchorInput = {
  tradeId: string;
  asset: string;
  side: string;
  amountUsd: string;
  entryPrice: string | null;
  exitPrice: string | null;
  pnlUsd: string | null;
  reasoning: unknown;
};

/**
 * Anchor a single closed paper trade on Arc. Reuses PortfolioDecisions.anchorDecision
 * with cycleId<-tradeId, swarmTraceHash<-sha256(reasoning), graphSnapshotHash<-zero,
 * ipfsCid<-`trade:{asset}:{side}`, verdict<-pnl summary.
 * Fire-and-forget; null when env is unset.
 */
export async function anchorClosedTrade(
  trade: ClosedTradeAnchorInput,
): Promise<TradeAnchorResult | null> {
  const contractAddress = process.env.NEXT_PUBLIC_ANCHOR_CONTRACT_ADDRESS;
  const walletId = process.env.NEXT_PUBLIC_AGENT_WALLET_ID;
  if (!contractAddress || !walletId) {
    console.warn("[anchor] env missing; skipping trade-close anchor");
    return null;
  }

  const tradeIdBytes32 = uuidToBytes32(trade.tradeId);
  const reasoningHash = sha256Hex(trade.reasoning);
  const amount = Number(trade.amountUsd);
  const pnlUsd = trade.pnlUsd ? Number(trade.pnlUsd) : null;
  const pnlPct = pnlUsd !== null && amount > 0 ? ((pnlUsd / amount) * 100).toFixed(2) : "n/a";
  const verdict = pnlUsd === null ? "settled" : pnlUsd >= 0 ? `+${pnlPct}%` : `${pnlPct}%`;
  const tag = `trade:${trade.asset}:${trade.side}`;

  const resp = await getSdk().createContractExecutionTransaction({
    walletId,
    contractAddress,
    abiFunctionSignature: "anchorDecision(bytes32,bytes32,bytes32,string,string)",
    abiParameters: [tradeIdBytes32, ZERO_BYTES32, reasoningHash, tag, verdict],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });

  return { txId: resp.data?.id ?? "", contractAddress, tradeIdBytes32, reasoningHash };
}

export type OpenedTradeAnchorInput = {
  tradeId: string;
  asset: string;
  side: "long" | "short";
  amountUsd: string;
  leverage: number | null;
  entryPrice: string | null;
  reasoning: AnchorJsonValue;
};

/**
 * Anchor a paper trade OPEN on Arc. Mirrors anchorClosedTrade but verdict
 * summarizes size + leverage instead of pnl.
 */
export async function anchorOpenedTrade(
  trade: OpenedTradeAnchorInput,
): Promise<TradeAnchorResult | null> {
  const contractAddress = process.env.NEXT_PUBLIC_ANCHOR_CONTRACT_ADDRESS;
  const walletId = process.env.NEXT_PUBLIC_AGENT_WALLET_ID;
  if (!contractAddress || !walletId) {
    console.warn("[anchor] env missing; skipping trade-open anchor");
    return null;
  }

  const tradeIdBytes32 = uuidToBytes32(trade.tradeId);
  const reasoningHash = sha256Hex(trade.reasoning);
  const lev = trade.leverage && trade.leverage > 0 ? `${trade.leverage}x` : "1x";
  const amount = Number(trade.amountUsd);
  const verdict = `$${amount.toFixed(0)} @ ${lev} ${trade.side}`;
  const tag = `trade:${trade.asset}:${trade.side}:open`;

  const resp = await getSdk().createContractExecutionTransaction({
    walletId,
    contractAddress,
    abiFunctionSignature: "anchorDecision(bytes32,bytes32,bytes32,string,string)",
    abiParameters: [tradeIdBytes32, ZERO_BYTES32, reasoningHash, tag, verdict],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });

  return { txId: resp.data?.id ?? "", contractAddress, tradeIdBytes32, reasoningHash };
}
