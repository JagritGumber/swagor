"use client";

import { Fragment, useState } from "react";
import { TradeReasonDetail } from "./trade-reason-detail";

export type BacktestTradeRow = {
  id: string;
  asset: string;
  side: string;
  entryDate: string;
  entryPrice: string;
  exitDate: string | null;
  exitPrice: string | null;
  sizeUsd: string;
  pnlUsd: string | null;
  pnlPct: string | null;
  biasConfidence: string;
  qualityScore?: string | null;
  status: string;
  exitReason: string | null;
  decisionReport?: Record<string, unknown> | null;
};

function fmtUsd(s: string | null): string {
  if (s === null) return "-";
  const n = Number(s);
  if (!Number.isFinite(n)) return "-";
  return `${n >= 0 ? "+" : ""}$${n.toFixed(2)}`;
}
function fmtPct(s: string | null): string {
  if (s === null) return "-";
  const n = Number(s);
  if (!Number.isFinite(n)) return "-";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}
function pnlTone(s: string | null): string {
  if (s === null) return "text-muted-foreground";
  const n = Number(s);
  if (!Number.isFinite(n) || n === 0) return "text-muted-foreground";
  return n > 0 ? "text-[var(--neon-green)]" : "text-[var(--neon-red)]";
}

const REASON_LABELS: Record<string, string> = {
  thesis_reduced: "partial harvest", thesis_closed: "thesis closed", thesis_invalidated: "thesis invalidated",
  thesis_flipped: "thesis flipped", stop_loss: "stop loss", take_profit: "take profit", end_of_backtest: "end of backtest",
};
function reasonLabel(r: string | null): string {
  return r ? (REASON_LABELS[r] ?? r) : "-";
}

export function BacktestTradesTable({ trades }: { trades: BacktestTradeRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (trades.length === 0) {
    return <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">No trades simulated yet. Click Simulate.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full font-mono text-[10px] uppercase tracking-[0.14em]">
        <thead>
          <tr className="border-b border-[var(--neon-green)]/30 text-left text-muted-foreground">
            <th className="px-2 py-1">Date</th>
            <th className="px-2 py-1">Asset</th>
            <th className="px-2 py-1">Side</th>
            <th className="px-2 py-1">Score</th>
            <th className="px-2 py-1 text-right">Entry</th>
            <th className="px-2 py-1 text-right">Exit</th>
            <th className="px-2 py-1 text-right">PnL $</th>
            <th className="px-2 py-1 text-right">PnL %</th>
            <th className="px-2 py-1">Exit reason</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <Fragment key={t.id}>
              <tr
                className="cursor-pointer border-b border-[var(--neon-green)]/15 hover:bg-[var(--neon-green)]/5"
                onClick={() => setOpenId((id) => (id === t.id ? null : t.id))}
              >
                <td className="px-2 py-1 text-foreground">{t.entryDate.slice(0, 10)}</td>
                <td className="px-2 py-1 text-foreground">{t.asset}</td>
                <td className={`px-2 py-1 ${t.side === "long" ? "text-[var(--neon-green)]" : "text-[var(--neon-red)]"}`}>{t.side}</td>
                <td className="px-2 py-1 text-muted-foreground" title="Engine quality score">{Number(t.qualityScore ?? t.biasConfidence).toFixed(2)}</td>
                <td className="px-2 py-1 text-right text-muted-foreground">{Number(t.entryPrice).toFixed(2)}</td>
                <td className="px-2 py-1 text-right text-muted-foreground">{t.exitPrice ? Number(t.exitPrice).toFixed(2) : "-"}</td>
                <td className={`px-2 py-1 text-right ${pnlTone(t.pnlUsd)}`}>{fmtUsd(t.pnlUsd)}</td>
                <td className={`px-2 py-1 text-right ${pnlTone(t.pnlPct)}`}>{fmtPct(t.pnlPct)}</td>
                <td className={`px-2 py-1 ${t.exitReason === "thesis_reduced" ? "text-[var(--neon-cyan)]" : "text-muted-foreground"}`}>{reasonLabel(t.exitReason)}</td>
              </tr>
              {openId === t.id && (
                <tr className="border-b border-[var(--neon-green)]/15 bg-black/40">
                  <td colSpan={9} className="px-3 py-2"><TradeReasonDetail report={t.decisionReport} /></td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
