import { getSdk, sha256Hex, uuidToBytes32, ZERO_BYTES32, type AnchorJsonValue } from "./sdk";
import { getArcContractOrSkip } from "./contracts";

export type TradeAnchorResult = {
  txId: string;
  contractAddress: string;
  tradeIdBytes32: string;
  reasoningHash: string;
};

export type ClosedTradeAnchorInput = {
  walletId: string;
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
 * Anchor a closed paper trade on Arc from the USER'S Circle Dev Wallet.
 * Reuses PortfolioDecisions.anchorDecision; verdict carries the pnl %.
 * Returns null if the shared contract address env is unset (dev mode).
 */
export async function anchorClosedTrade(
  trade: ClosedTradeAnchorInput,
): Promise<TradeAnchorResult | null> {
  const contractAddress = await getArcContractOrSkip("portfolio_decisions");
  if (!contractAddress) return null;

  const tradeIdBytes32 = uuidToBytes32(trade.tradeId);
  const reasoningHash = sha256Hex(trade.reasoning);
  const amount = Number(trade.amountUsd);
  const pnlUsd = trade.pnlUsd ? Number(trade.pnlUsd) : null;
  const pnlPct = pnlUsd !== null && amount > 0 ? ((pnlUsd / amount) * 100).toFixed(2) : "n/a";
  const verdict = pnlUsd === null ? "settled" : pnlUsd >= 0 ? `+${pnlPct}%` : `${pnlPct}%`;
  const tag = `trade:${trade.asset}:${trade.side}`;

  const resp = await getSdk().createContractExecutionTransaction({
    walletId: trade.walletId,
    contractAddress,
    abiFunctionSignature: "anchorDecision(bytes32,bytes32,bytes32,string,string)",
    abiParameters: [tradeIdBytes32, ZERO_BYTES32, reasoningHash, tag, verdict],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });

  return { txId: resp.data?.id ?? "", contractAddress, tradeIdBytes32, reasoningHash };
}

export type OpenedTradeAnchorInput = {
  walletId: string;
  tradeId: string;
  asset: string;
  side: "long" | "short";
  amountUsd: string;
  leverage: number | null;
  entryPrice: string | null;
  reasoning: AnchorJsonValue;
};

/**
 * Anchor a paper trade OPEN from the user's Circle wallet. Verdict
 * summarizes size + leverage instead of pnl.
 */
export async function anchorOpenedTrade(
  trade: OpenedTradeAnchorInput,
): Promise<TradeAnchorResult | null> {
  const contractAddress = await getArcContractOrSkip("portfolio_decisions");
  if (!contractAddress) return null;

  const tradeIdBytes32 = uuidToBytes32(trade.tradeId);
  const reasoningHash = sha256Hex(trade.reasoning);
  const lev = trade.leverage && trade.leverage > 0 ? `${trade.leverage}x` : "1x";
  const amount = Number(trade.amountUsd);
  const verdict = `$${amount.toFixed(0)} @ ${lev} ${trade.side}`;
  const tag = `trade:${trade.asset}:${trade.side}:open`;

  const resp = await getSdk().createContractExecutionTransaction({
    walletId: trade.walletId,
    contractAddress,
    abiFunctionSignature: "anchorDecision(bytes32,bytes32,bytes32,string,string)",
    abiParameters: [tradeIdBytes32, ZERO_BYTES32, reasoningHash, tag, verdict],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });

  return { txId: resp.data?.id ?? "", contractAddress, tradeIdBytes32, reasoningHash };
}
