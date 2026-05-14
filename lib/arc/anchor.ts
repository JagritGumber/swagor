import { createHash } from "node:crypto";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { db } from "@/lib/db/client";
import { trades, monitorTicks } from "@/lib/db/schema";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";

/**
 * Recursive JSON-safe value type used for anchor reasoning / context
 * payloads. Replaces `unknown` at service boundaries so the compiler
 * enforces JSON.stringify-safety on inputs hashed into trace bytes32.
 */
export type AnchorJsonValue =
  | string
  | number
  | boolean
  | null
  | AnchorJsonValue[]
  | { [key: string]: AnchorJsonValue };

/** Per-source cap for the pending-anchor poll. Bounds work when Circle
 *  is sluggish or a backlog builds up; oldest-first ordering ensures the
 *  longest-pending rows retry first. */
const POLL_LIMIT_PER_SOURCE = 20;

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
 * Anchor a paper trade OPEN on Arc (M5). Mirrors anchorClosedTrade but the
 * verdict string summarizes size + leverage instead of pnl. The trace hash
 * captures the full agent context the Fast Trader saw (passed as `reasoning`).
 * Fire-and-forget from openPaperTrade; trade insert must not block on Circle.
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
  const zeroBytes32 = `0x${"0".repeat(64)}` as `0x${string}`;
  const lev = trade.leverage && trade.leverage > 0 ? `${trade.leverage}x` : "1x";
  const amount = Number(trade.amountUsd);
  const verdict = `$${amount.toFixed(0)} @ ${lev} ${trade.side}`;
  const tag = `trade:${trade.asset}:${trade.side}:open`;

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
 * Anchor a watcher decision on Arc (M5). Fires for `execute` and
 * `risk_emergency` verdicts only. `hold` is not anchored (too noisy);
 * `deliberate` is anchored via the swarm cycle path. Rationale is truncated
 * to 120 chars for the on-chain verdict string; full context is hashed.
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
  const zeroBytes32 = `0x${"0".repeat(64)}` as `0x${string}`;
  const tag = `watcher:${input.verdict}`;
  const verdict = input.rationale.slice(0, 120);

  const resp = await getSdk().createContractExecutionTransaction({
    walletId,
    contractAddress,
    abiFunctionSignature: "anchorDecision(bytes32,bytes32,bytes32,string,string)",
    abiParameters: [tickIdBytes32, zeroBytes32, traceHash, tag, verdict],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });

  return {
    txId: resp.data?.id ?? "",
    contractAddress,
    tickIdBytes32,
    traceHash,
  };
}

const TERMINAL_FAIL_STATES = new Set(["FAILED", "CANCELLED", "DENIED"]);

/**
 * Resolve one Circle tx id to its on-chain state. Returns the on-chain hash
 * when state=COMPLETE, a `failed:<STATE>` sentinel for terminal failures,
 * or null when still pending (caller should leave the column untouched).
 */
async function resolveCircleTx(
  circleTxId: string,
): Promise<{ outcome: "confirmed"; onchainHash: string } | { outcome: "failed"; sentinel: string } | { outcome: "pending" }> {
  const resp = await getSdk().getTransaction({ id: circleTxId });
  const body = resp.data as { data?: { transaction?: { state?: string; txHash?: string } } } | undefined;
  const tx = body?.data?.transaction;
  const state = tx?.state;
  if (state === "COMPLETE" && tx?.txHash) return { outcome: "confirmed", onchainHash: tx.txHash };
  if (state && TERMINAL_FAIL_STATES.has(state)) return { outcome: "failed", sentinel: `failed:${state}` };
  return { outcome: "pending" };
}

/**
 * Poll Circle for every anchor that has a Circle transaction id but no
 * resolved on-chain hash yet. Updates the corresponding `*OnchainTxHash`
 * column when state=COMPLETE; stamps a `failed:<STATE>` sentinel for
 * terminal failures so we stop polling them.
 *
 * Three sources scanned per heartbeat (M5):
 *   - trades.arcAnchorTx       -> trades.arcOnchainTxHash    (trade close)
 *   - trades.openAnchorTx      -> trades.openOnchainTxHash   (trade open)
 *   - monitor_ticks.arcAnchorTx -> monitor_ticks.arcOnchainTxHash (watcher)
 *
 * Each is an indexed lookup on a small "fired but not mined" window. Cheap.
 */
export async function pollPendingAnchors(): Promise<{
  scanned: number;
  resolved: number;
  failed: number;
}> {
  let scanned = 0;
  let resolved = 0;
  let failed = 0;

  // Source 1: trade closes (existing)
  const pendingCloses = await db
    .select({ id: trades.id, txId: trades.arcAnchorTx })
    .from(trades)
    .where(and(isNotNull(trades.arcAnchorTx), isNull(trades.arcOnchainTxHash)))
    .orderBy(asc(trades.createdAt))
    .limit(POLL_LIMIT_PER_SOURCE);
  scanned += pendingCloses.length;
  for (const row of pendingCloses) {
    if (!row.txId) continue;
    try {
      const out = await resolveCircleTx(row.txId);
      if (out.outcome === "confirmed") {
        await db.update(trades).set({ arcOnchainTxHash: out.onchainHash }).where(eq(trades.id, row.id));
        resolved++;
      } else if (out.outcome === "failed") {
        await db.update(trades).set({ arcOnchainTxHash: out.sentinel }).where(eq(trades.id, row.id));
        failed++;
      }
    } catch (err) {
      console.error(`[anchor-poll] close ${row.txId} failed:`, err);
    }
  }

  // Source 2: trade opens (M5)
  const pendingOpens = await db
    .select({ id: trades.id, txId: trades.openAnchorTx })
    .from(trades)
    .where(and(isNotNull(trades.openAnchorTx), isNull(trades.openOnchainTxHash)))
    .orderBy(asc(trades.createdAt))
    .limit(POLL_LIMIT_PER_SOURCE);
  scanned += pendingOpens.length;
  for (const row of pendingOpens) {
    if (!row.txId) continue;
    try {
      const out = await resolveCircleTx(row.txId);
      if (out.outcome === "confirmed") {
        await db.update(trades).set({ openOnchainTxHash: out.onchainHash }).where(eq(trades.id, row.id));
        resolved++;
      } else if (out.outcome === "failed") {
        await db.update(trades).set({ openOnchainTxHash: out.sentinel }).where(eq(trades.id, row.id));
        failed++;
      }
    } catch (err) {
      console.error(`[anchor-poll] open ${row.txId} failed:`, err);
    }
  }

  // Source 3: watcher anchors (M5)
  const pendingTicks = await db
    .select({ id: monitorTicks.id, txId: monitorTicks.arcAnchorTx })
    .from(monitorTicks)
    .where(and(isNotNull(monitorTicks.arcAnchorTx), isNull(monitorTicks.arcOnchainTxHash)))
    .orderBy(asc(monitorTicks.createdAt))
    .limit(POLL_LIMIT_PER_SOURCE);
  scanned += pendingTicks.length;
  for (const row of pendingTicks) {
    if (!row.txId) continue;
    try {
      const out = await resolveCircleTx(row.txId);
      if (out.outcome === "confirmed") {
        await db.update(monitorTicks).set({ arcOnchainTxHash: out.onchainHash }).where(eq(monitorTicks.id, row.id));
        resolved++;
      } else if (out.outcome === "failed") {
        await db.update(monitorTicks).set({ arcOnchainTxHash: out.sentinel }).where(eq(monitorTicks.id, row.id));
        failed++;
      }
    } catch (err) {
      console.error(`[anchor-poll] watcher ${row.txId} failed:`, err);
    }
  }

  return { scanned, resolved, failed };
}
