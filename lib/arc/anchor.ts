import { createHash } from "node:crypto";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { db } from "@/lib/db/client";
import { trades } from "@/lib/db/schema";
import { and, eq, isNotNull, isNull } from "drizzle-orm";

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
 * Anchor a single closed paper trade on Arc. Reuses the existing
 * PortfolioDecisions.anchorDecision ABI by mapping:
 *   - cycleId param   -> tradeId (bytes32-padded)
 *   - swarmTraceHash  -> sha256(reasoning blob)
 *   - graphSnapshotHash -> zero bytes32 (unused for trade closes)
 *   - ipfsCid (string) -> "trade:{asset}:{side}"
 *   - verdict (string) -> "+X.XX%" or "-X.XX%" pnl summary
 *
 * One anchor per closed trade is the only on-chain spend Selbo makes -- all
 * watcher ticks and cycle deliberations stay in DB. Returns null when the
 * anchor contract or wallet env is unset (dev mode), so callers can fire
 * this non-blocking from the trade settle path.
 */
export async function anchorClosedTrade(
  trade: ClosedTradeAnchorInput,
): Promise<TradeAnchorResult | null> {
  const contractAddress = process.env.NEXT_PUBLIC_ANCHOR_CONTRACT_ADDRESS;
  const walletId = process.env.NEXT_PUBLIC_AGENT_WALLET_ID;

  if (!contractAddress) {
    console.warn(
      "[anchor] NEXT_PUBLIC_ANCHOR_CONTRACT_ADDRESS not set; skipping trade anchor.",
    );
    return null;
  }
  if (!walletId) {
    console.warn("[anchor] NEXT_PUBLIC_AGENT_WALLET_ID not set; skipping trade anchor");
    return null;
  }

  const tradeIdBytes32 = uuidToBytes32(trade.tradeId);
  const reasoningHash = sha256Hex(trade.reasoning);
  const zeroBytes32 = `0x${"0".repeat(64)}` as `0x${string}`;
  const amount = Number(trade.amountUsd);
  const pnlUsd = trade.pnlUsd ? Number(trade.pnlUsd) : null;
  const pnlPct =
    pnlUsd !== null && amount > 0 ? ((pnlUsd / amount) * 100).toFixed(2) : "n/a";
  const verdict = pnlUsd === null ? "settled" : pnlUsd >= 0 ? `+${pnlPct}%` : `${pnlPct}%`;
  const tag = `trade:${trade.asset}:${trade.side}`;

  const resp = await getSdk().createContractExecutionTransaction({
    walletId,
    contractAddress,
    abiFunctionSignature: "anchorDecision(bytes32,bytes32,bytes32,string,string)",
    abiParameters: [tradeIdBytes32, zeroBytes32, reasoningHash, tag, verdict],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });

  return {
    txId: resp.data?.id ?? "",
    contractAddress,
    tradeIdBytes32,
    reasoningHash,
  };
}

const TERMINAL_FAIL_STATES = new Set(["FAILED", "CANCELLED", "DENIED"]);

/**
 * Poll Circle for trades that have a Circle transaction id but no resolved
 * on-chain hash yet. Updates `arcOnchainTxHash` once the tx reaches
 * `COMPLETE`. Failed/cancelled/denied txs are stamped with a sentinel so
 * we stop polling them.
 *
 * Called from the watcher tick handler each cron heartbeat. Cheap: only
 * reads rows where the Circle id is set AND the on-chain hash is null,
 * which is the small window of "anchor-fired but not yet mined" trades.
 */
export async function pollPendingAnchors(): Promise<{
  scanned: number;
  resolved: number;
  failed: number;
}> {
  const pending = await db
    .select({ id: trades.id, arcAnchorTx: trades.arcAnchorTx })
    .from(trades)
    .where(and(isNotNull(trades.arcAnchorTx), isNull(trades.arcOnchainTxHash)));

  let resolved = 0;
  let failed = 0;

  for (const row of pending) {
    if (!row.arcAnchorTx) continue;
    try {
      const resp = await getSdk().getTransaction({ id: row.arcAnchorTx });
      const body = resp.data as { data?: { transaction?: { state?: string; txHash?: string } } } | undefined;
      const tx = body?.data?.transaction;
      const state = tx?.state;
      if (state === "COMPLETE" && tx?.txHash) {
        await db.update(trades).set({ arcOnchainTxHash: tx.txHash }).where(eq(trades.id, row.id));
        resolved++;
      } else if (state && TERMINAL_FAIL_STATES.has(state)) {
        await db.update(trades).set({ arcOnchainTxHash: `failed:${state}` }).where(eq(trades.id, row.id));
        failed++;
      }
    } catch (err) {
      console.error(`[anchor-poll] getTransaction(${row.arcAnchorTx}) failed:`, err);
    }
  }

  return { scanned: pending.length, resolved, failed };
}
