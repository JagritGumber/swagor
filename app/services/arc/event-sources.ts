import "server-only";

import { db } from "@/lib/db/client";
import { trades, monitorTicks, dailyPlans } from "@/lib/db/schema";
import { and, desc, eq, inArray, isNull, isNotNull } from "drizzle-orm";

export type ArcEvent = {
  id: string;
  type: "trade_open" | "trade_close" | "watcher_execute" | "watcher_risk_emergency" | "analysis";
  label: string;
  status: "pending" | "confirmed" | "failed";
  txId: string | null;
  onchainTxHash: string | null;
  arcscanUrl: string | null;
  createdAt: string;
};

const ARCSCAN_TX = "https://testnet.arcscan.app/tx/";
function deriveStatus(txId: string | null, hash: string | null): ArcEvent["status"] {
  if (hash && hash.startsWith("failed:")) return "failed";
  if (hash) return "confirmed";
  return "pending";
}
function arcscanFor(hash: string | null): string | null {
  return !hash || hash.startsWith("failed:") ? null : `${ARCSCAN_TX}${hash}`;
}

export async function tradeEvents(userId: string, limit: number): Promise<ArcEvent[]> {
  const rows = await db.select({
    id: trades.id, asset: trades.asset, side: trades.side, amountUsd: trades.amountUsd, pnlUsd: trades.pnlUsd,
    openAnchorTx: trades.openAnchorTx, openOnchainTxHash: trades.openOnchainTxHash,
    arcAnchorTx: trades.arcAnchorTx, arcOnchainTxHash: trades.arcOnchainTxHash,
    openedAt: trades.openedAt, closedAt: trades.closedAt, createdAt: trades.createdAt,
  }).from(trades).where(and(eq(trades.userId, userId), inArray(trades.status, ["open", "closed"])))
    .orderBy(desc(trades.createdAt)).limit(limit * 2);
  const out: ArcEvent[] = [];
  for (const t of rows) {
    if (t.openAnchorTx) out.push({
      id: `${t.id}:open`, type: "trade_open", label: `Open ${t.side.toUpperCase()} ${t.asset} $${Number(t.amountUsd).toFixed(0)}`,
      status: deriveStatus(t.openAnchorTx, t.openOnchainTxHash), txId: t.openAnchorTx, onchainTxHash: t.openOnchainTxHash,
      arcscanUrl: arcscanFor(t.openOnchainTxHash), createdAt: (t.openedAt ?? t.createdAt).toISOString(),
    });
    if (t.arcAnchorTx) {
      const pnl = t.pnlUsd !== null ? Number(t.pnlUsd) : null;
      const pnlLabel = pnl === null ? "settled" : pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
      out.push({
        id: `${t.id}:close`, type: "trade_close", label: `Close ${t.side.toUpperCase()} ${t.asset} ${pnlLabel}`,
        status: deriveStatus(t.arcAnchorTx, t.arcOnchainTxHash), txId: t.arcAnchorTx, onchainTxHash: t.arcOnchainTxHash,
        arcscanUrl: arcscanFor(t.arcOnchainTxHash), createdAt: (t.closedAt ?? t.createdAt).toISOString(),
      });
    }
  }
  return out;
}

export async function tickEvents(instanceId: string, limit: number): Promise<ArcEvent[]> {
  const rows = await db.select({
    id: monitorTicks.id, verdict: monitorTicks.verdict, rationale: monitorTicks.rationale,
    arcAnchorTx: monitorTicks.arcAnchorTx, arcOnchainTxHash: monitorTicks.arcOnchainTxHash, createdAt: monitorTicks.createdAt,
  }).from(monitorTicks).where(and(eq(monitorTicks.selboInstanceId, instanceId), isNotNull(monitorTicks.arcAnchorTx)))
    .orderBy(desc(monitorTicks.createdAt)).limit(limit);
  return rows.map((tk) => {
    const emergency = tk.verdict === "risk_emergency";
    return {
      id: tk.id, type: emergency ? "watcher_risk_emergency" as const : "watcher_execute" as const,
      label: `${emergency ? "Risk emergency" : "Watcher execute"}: ${tk.rationale.slice(0, 80)}`,
      status: deriveStatus(tk.arcAnchorTx, tk.arcOnchainTxHash), txId: tk.arcAnchorTx,
      onchainTxHash: tk.arcOnchainTxHash, arcscanUrl: arcscanFor(tk.arcOnchainTxHash), createdAt: tk.createdAt.toISOString(),
    };
  });
}

/** Anchored LIVE daily analyses (backtests are never anchored). */
export async function analysisEvents(userId: string, limit: number): Promise<ArcEvent[]> {
  const rows = await db.select({
    id: dailyPlans.id, gen: dailyPlans.generatedAt, md: dailyPlans.planMarkdown,
    anchorTx: dailyPlans.arcAnchorTx, hash: dailyPlans.arcOnchainTxHash,
  }).from(dailyPlans).where(and(eq(dailyPlans.userId, userId), isNull(dailyPlans.backtestRunId), isNotNull(dailyPlans.arcAnchorTx)))
    .orderBy(desc(dailyPlans.generatedAt)).limit(limit);
  return rows.map((p) => ({
    id: `${p.id}:analysis`, type: "analysis" as const,
    label: `Analysis ${p.gen.toISOString().slice(0, 10)}: ${(p.md ?? "daily plan").split("\n").find((l) => l.trim())?.slice(0, 70) ?? "daily plan"}`,
    status: deriveStatus(p.anchorTx, p.hash), txId: p.anchorTx, onchainTxHash: p.hash,
    arcscanUrl: arcscanFor(p.hash), createdAt: p.gen.toISOString(),
  }));
}
