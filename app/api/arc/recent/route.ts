import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { trades, monitorTicks, selboInstances } from "@/lib/db/schema";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type ArcEvent = {
  id: string;
  type: "trade_open" | "trade_close" | "watcher_execute" | "watcher_risk_emergency";
  label: string;
  status: "pending" | "confirmed" | "failed";
  txId: string | null;
  onchainTxHash: string | null;
  arcscanUrl: string | null;
  createdAt: string;
};

const ARCSCAN_TX = "https://testnet.arcscan.app/tx/";

function deriveStatus(txId: string | null, onchainHash: string | null): ArcEvent["status"] {
  if (onchainHash && onchainHash.startsWith("failed:")) return "failed";
  if (onchainHash) return "confirmed";
  if (txId) return "pending";
  return "pending";
}

function arcscanFor(onchainHash: string | null): string | null {
  if (!onchainHash || onchainHash.startsWith("failed:")) return null;
  return `${ARCSCAN_TX}${onchainHash}`;
}

/**
 * GET /api/arc/recent?limit=20
 *
 * Returns the calling user's most-recent Arc anchor events across three
 * sources: trade opens, trade closes, and watcher decisions (execute /
 * risk_emergency). Existing closed trades with on-chain hashes already
 * backfilled by Circle are included naturally; no migration required.
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = clampLimit(searchParams.get("limit"));
  const events = await collectArcEvents(session.user.id, limit);
  return NextResponse.json({ events });
}

/** Clamp the user-supplied limit to [1, 50] with default 20; rejects NaN
 *  / non-finite values silently so a bad `?limit=abc` doesn't 500. */
export function clampLimit(raw: string | null): number {
  const n = Number(raw ?? "20");
  if (!Number.isFinite(n)) return 20;
  return Math.min(Math.max(Math.floor(n), 1), 50);
}

export async function collectArcEvents(userId: string, limit: number): Promise<ArcEvent[]> {
  const [instance] = await db
    .select({ id: selboInstances.id })
    .from(selboInstances)
    .where(eq(selboInstances.userId, userId))
    .limit(1);
  if (!instance) return [];

  const tradeRows = await db
    .select({
      id: trades.id,
      asset: trades.asset,
      side: trades.side,
      amountUsd: trades.amountUsd,
      pnlUsd: trades.pnlUsd,
      openAnchorTx: trades.openAnchorTx,
      openOnchainTxHash: trades.openOnchainTxHash,
      arcAnchorTx: trades.arcAnchorTx,
      arcOnchainTxHash: trades.arcOnchainTxHash,
      openedAt: trades.openedAt,
      closedAt: trades.closedAt,
      createdAt: trades.createdAt,
    })
    .from(trades)
    .where(and(eq(trades.userId, userId), inArray(trades.status, ["open", "closed"])))
    .orderBy(desc(trades.createdAt))
    .limit(limit * 2);

  const tickRows = await db
    .select({
      id: monitorTicks.id,
      verdict: monitorTicks.verdict,
      rationale: monitorTicks.rationale,
      arcAnchorTx: monitorTicks.arcAnchorTx,
      arcOnchainTxHash: monitorTicks.arcOnchainTxHash,
      createdAt: monitorTicks.createdAt,
    })
    .from(monitorTicks)
    .where(and(eq(monitorTicks.selboInstanceId, instance.id), isNotNull(monitorTicks.arcAnchorTx)))
    .orderBy(desc(monitorTicks.createdAt))
    .limit(limit);

  const events: ArcEvent[] = [];

  for (const t of tradeRows) {
    if (t.openAnchorTx) {
      events.push({
        id: `${t.id}:open`,
        type: "trade_open",
        label: `Open ${t.side.toUpperCase()} ${t.asset} $${Number(t.amountUsd).toFixed(0)}`,
        status: deriveStatus(t.openAnchorTx, t.openOnchainTxHash),
        txId: t.openAnchorTx,
        onchainTxHash: t.openOnchainTxHash,
        arcscanUrl: arcscanFor(t.openOnchainTxHash),
        createdAt: (t.openedAt ?? t.createdAt).toISOString(),
      });
    }
    if (t.arcAnchorTx) {
      const pnl = t.pnlUsd !== null ? Number(t.pnlUsd) : null;
      const pnlLabel = pnl === null ? "settled" : pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
      events.push({
        id: `${t.id}:close`,
        type: "trade_close",
        label: `Close ${t.side.toUpperCase()} ${t.asset} ${pnlLabel}`,
        status: deriveStatus(t.arcAnchorTx, t.arcOnchainTxHash),
        txId: t.arcAnchorTx,
        onchainTxHash: t.arcOnchainTxHash,
        arcscanUrl: arcscanFor(t.arcOnchainTxHash),
        createdAt: (t.closedAt ?? t.createdAt).toISOString(),
      });
    }
  }

  for (const tick of tickRows) {
    const isEmergency = tick.verdict === "risk_emergency";
    events.push({
      id: tick.id,
      type: isEmergency ? "watcher_risk_emergency" : "watcher_execute",
      label: `${isEmergency ? "Risk emergency" : "Watcher execute"}: ${tick.rationale.slice(0, 80)}`,
      status: deriveStatus(tick.arcAnchorTx, tick.arcOnchainTxHash),
      txId: tick.arcAnchorTx,
      onchainTxHash: tick.arcOnchainTxHash,
      arcscanUrl: arcscanFor(tick.arcOnchainTxHash),
      createdAt: tick.createdAt.toISOString(),
    });
  }

  events.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return events.slice(0, limit);
}
