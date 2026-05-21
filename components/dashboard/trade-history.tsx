"use client";

import { useState } from "react";
import type { ClosedTradeView } from "@/app/services/trades.service";
import { TradeDecisionDrawer } from "@/components/dashboard/bento/trade-decision-drawer";
import { ArcTxLink } from "@/components/ui/arc-tx-link";

function fmtUsd(n: number | null): string {
  if (n === null) return "n/a";
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${n.toFixed(2)}`;
}

function fmtPct(n: number | null): string {
  if (n === null) return "n/a";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function fmtTime(d: Date | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleString();
}

/**
 * Closed-trade history. Each row is a click target that opens the
 * TradeReasoningModal with the linked watcher tick + proposal + Arc
 * anchors. Arc anchor links inside the row stop propagation so they
 * still navigate to Arcscan instead of opening the modal.
 */
export function TradeHistory({ trades, admin = false, bare = false }: { trades: ClosedTradeView[]; admin?: boolean; bare?: boolean }) {
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  if (trades.length === 0) return null;

  return (
    <section className={bare ? "" : "border border-[var(--hairline-strong)] bg-black p-6"}>
      {!bare && (
        <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
          Trade history
        </h2>
      )}
      <div className={`overflow-x-auto ${bare ? "" : "mt-4"}`}>
        <table className="w-full min-w-[640px] border-y border-[var(--hairline-strong)]">
          <thead>
            <tr className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <th className="py-2 text-left">Asset</th>
              <th className="py-2 text-left">Side</th>
              <th className="py-2 text-right">Size</th>
              <th className="py-2 text-right">Entry</th>
              <th className="py-2 text-right">Exit</th>
              <th className="py-2 text-right">P/L</th>
              <th className="py-2 text-right">%</th>
              <th className="py-2 text-right">Closed</th>
              <th className="py-2 text-right">Reason</th>
              <th className="py-2 text-right">Open</th>
              <th className="py-2 text-right">Close</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--hairline)]">
            {trades.map((t) => {
              const tone =
                t.pnlUsd === null
                  ? "text-foreground"
                  : t.pnlUsd >= 0
                    ? "text-[var(--neon-green)]"
                    : "text-[var(--neon-red)]";
              return (
                <tr
                  key={t.tradeId}
                  onClick={() => setSelectedTradeId((cur) => (cur === t.tradeId ? null : t.tradeId))}
                  aria-expanded={selectedTradeId === t.tradeId}
                  className={`cursor-pointer font-mono text-xs transition hover:bg-[#080808] ${selectedTradeId === t.tradeId ? "bg-[#080808]" : ""}`}
                >
                  <td className="py-3 text-left text-foreground">{t.asset}</td>
                  <td className="py-3 text-left uppercase text-muted-foreground">{t.side}</td>
                  <td className="py-3 text-right text-foreground tabular-nums">${t.amountUsd.toFixed(2)}</td>
                  <td className="py-3 text-right text-muted-foreground tabular-nums">
                    {t.entryPrice ? `$${t.entryPrice.toFixed(2)}` : "-"}
                  </td>
                  <td className="py-3 text-right text-muted-foreground tabular-nums">
                    {t.exitPrice ? `$${t.exitPrice.toFixed(2)}` : "-"}
                  </td>
                  <td className={`py-3 text-right tabular-nums ${tone}`}>{fmtUsd(t.pnlUsd)}</td>
                  <td className={`py-3 text-right tabular-nums ${tone}`}>{fmtPct(t.pnlPct)}</td>
                  <td className="py-3 text-right text-muted-foreground tabular-nums">
                    {fmtTime(t.closedAt)}
                  </td>
                  <td className="py-3 text-right">
                    {t.safetyTriggerReason === "stop_loss" ? (
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--neon-red)]">
                        stop-loss
                      </span>
                    ) : t.safetyTriggerReason === "take_profit" ? (
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--neon-green)]">
                        take-profit
                      </span>
                    ) : (
                      <span className="text-muted-foreground">agent</span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <ArcTxLink hash={t.openOnchainTxHash} emptyLabel="pending" stopPropagation />
                  </td>
                  <td className="py-3 text-right">
                    <ArcTxLink hash={t.arcOnchainTxHash} emptyLabel="pending" stopPropagation />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!bare && (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Click any row to see why Selbo opened and closed the trade.
        </p>
      )}
      {selectedTradeId && (
        <TradeDecisionDrawer
          tradeId={selectedTradeId}
          admin={admin}
          onClose={() => setSelectedTradeId(null)}
        />
      )}
    </section>
  );
}

