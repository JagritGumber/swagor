import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { trades, monitorTicks } from "@/lib/db/schema";
import { getSdk } from "./sdk";

const POLL_LIMIT_PER_SOURCE = 20;
const TERMINAL_FAIL_STATES = new Set(["FAILED", "CANCELLED", "DENIED"]);

type ResolveOutcome =
  | { outcome: "confirmed"; onchainHash: string }
  | { outcome: "failed"; sentinel: string }
  | { outcome: "pending" };

async function resolveCircleTx(circleTxId: string): Promise<ResolveOutcome> {
  const resp = await getSdk().getTransaction({ id: circleTxId });
  // Circle SDK returns { data: { transaction: {...} } }, so resp.data.transaction.
  // (Was previously read as resp.data.data.transaction, one level too deep,
  // which meant the poller never resolved any anchor to its on-chain hash.)
  const tx = (resp.data as { transaction?: { state?: string; txHash?: string } } | undefined)?.transaction;
  const state = tx?.state;
  if (state === "COMPLETE" && tx?.txHash) return { outcome: "confirmed", onchainHash: tx.txHash };
  if (state && TERMINAL_FAIL_STATES.has(state)) return { outcome: "failed", sentinel: `failed:${state}` };
  return { outcome: "pending" };
}

type SourceScanResult = { scanned: number; resolved: number; failed: number };

export type AnchorSource = {
  name: string;
  fetchPending: () => Promise<Array<{ id: string; txId: string | null }>>;
  setOnchain: (id: string, value: string) => Promise<unknown>;
};

async function scanSource(src: AnchorSource): Promise<SourceScanResult> {
  const pending = await src.fetchPending();
  let resolved = 0;
  let failed = 0;
  for (const row of pending) {
    if (!row.txId) continue;
    try {
      const out = await resolveCircleTx(row.txId);
      if (out.outcome === "confirmed") {
        await src.setOnchain(row.id, out.onchainHash);
        resolved++;
      } else if (out.outcome === "failed") {
        await src.setOnchain(row.id, out.sentinel);
        failed++;
      }
    } catch (err) {
      console.error(`[anchor-poll] ${src.name} ${row.txId} failed:`, err);
    }
  }
  return { scanned: pending.length, resolved, failed };
}

const SOURCES: AnchorSource[] = [
  {
    name: "trades-close",
    fetchPending: () => db.select({ id: trades.id, txId: trades.arcAnchorTx }).from(trades)
      .where(and(isNotNull(trades.arcAnchorTx), isNull(trades.arcOnchainTxHash)))
      .orderBy(asc(trades.createdAt)).limit(POLL_LIMIT_PER_SOURCE),
    setOnchain: (id, v) => db.update(trades).set({ arcOnchainTxHash: v }).where(eq(trades.id, id)),
  },
  {
    name: "trades-open",
    fetchPending: () => db.select({ id: trades.id, txId: trades.openAnchorTx }).from(trades)
      .where(and(isNotNull(trades.openAnchorTx), isNull(trades.openOnchainTxHash)))
      .orderBy(asc(trades.createdAt)).limit(POLL_LIMIT_PER_SOURCE),
    setOnchain: (id, v) => db.update(trades).set({ openOnchainTxHash: v }).where(eq(trades.id, id)),
  },
  {
    name: "watcher",
    fetchPending: () => db.select({ id: monitorTicks.id, txId: monitorTicks.arcAnchorTx }).from(monitorTicks)
      .where(and(isNotNull(monitorTicks.arcAnchorTx), isNull(monitorTicks.arcOnchainTxHash)))
      .orderBy(asc(monitorTicks.createdAt)).limit(POLL_LIMIT_PER_SOURCE),
    setOnchain: (id, v) => db.update(monitorTicks).set({ arcOnchainTxHash: v }).where(eq(monitorTicks.id, id)),
  },
];

/**
 * Resolve every queued Circle anchor tx to its on-chain hash. Registry-driven
 * so new sources (daily plans, backtests, broker fees) plug in via one entry.
 * Sequential per source to keep behavior identical to the pre-refactor poller.
 */
export async function pollPendingAnchors(): Promise<SourceScanResult> {
  let acc: SourceScanResult = { scanned: 0, resolved: 0, failed: 0 };
  for (const src of SOURCES) {
    const r = await scanSource(src);
    acc = { scanned: acc.scanned + r.scanned, resolved: acc.resolved + r.resolved, failed: acc.failed + r.failed };
  }
  return acc;
}

export function registerAnchorSource(src: AnchorSource): void {
  SOURCES.push(src);
}
