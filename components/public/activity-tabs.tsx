"use client";

import { useState } from "react";
import { TradeHistory } from "@/components/dashboard/trade-history";
import { PositionsTable } from "@/components/dashboard/positions-table";
import { ArcActivityCard } from "@/components/dashboard/arc-activity-card";
import { BacktestTradesTable, type BacktestTradeRow } from "@/components/dashboard/bento/backtest-trades-table";
import type { ClosedTradeView } from "@/app/services/trades.service";
import type { PositionView } from "@/app/services/positions.service";

type TabKey = "trades" | "activity" | "positions";

const TABS: Array<[TabKey, string]> = [
  ["trades", "Trades"],
  ["activity", "Activity"],
  ["positions", "Positions"],
];

/**
 * Center tabbed panel. One bounded, internally-scrolling surface that holds
 * the trade table, the Arc activity feed, and open positions so the page
 * itself never grows. Trades show the featured backtest rows when present,
 * otherwise live closed trades.
 */
export function ActivityTabs({ username, tradeRows, closedTrades, positions, arcEndpoint }: {
  username: string;
  tradeRows: BacktestTradeRow[];
  closedTrades: ClosedTradeView[];
  positions: PositionView[];
  arcEndpoint?: string;
}) {
  const [tab, setTab] = useState<TabKey>("trades");

  return (
    <div className="flex h-full flex-col border border-[var(--hairline-strong)] bg-black">
      <div className="flex shrink-0 border-b border-[var(--hairline-strong)]">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] transition ${
              tab === key
                ? "border-b-2 border-[var(--neon-cyan)] text-[var(--neon-cyan)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "trades" && (
          <>
            {tradeRows.length > 0 ? (
              <BacktestTradesTable trades={tradeRows} />
            ) : closedTrades.length > 0 ? (
              <TradeHistory trades={closedTrades} bare />
            ) : (
              <p className="p-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">No trades yet - Selbo opens one when a setup matches its thesis.</p>
            )}
          </>
        )}
        {tab === "activity" && (
          <ArcActivityCard endpoint={arcEndpoint ?? `/api/selbo/${encodeURIComponent(username)}/arc`} bare />
        )}
        {tab === "positions" && <PositionsTable positions={positions} bare />}
      </div>
    </div>
  );
}
