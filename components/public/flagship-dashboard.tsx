"use client";

import { MarketChartCard } from "@/components/dashboard/market-chart-card";
import { FlagshipWatchlist, type FlagshipIdentity } from "./flagship-watchlist";
import { ActivityTabs } from "./activity-tabs";
import { WorkflowViewer } from "./workflow-viewer";
import type { BacktestTradeRow } from "@/components/dashboard/bento/backtest-trades-table";
import type { ClosedTradeView } from "@/app/services/trades.service";
import type { PositionView } from "@/app/services/positions.service";

type Headline = { trades: number; winRate: number | null; pnlUsd: number };

function StatReadout({ headline }: { headline: Headline }) {
  const wr = headline.winRate === null ? null : Math.round(headline.winRate * 100);
  const pnl = headline.pnlUsd;
  const pnlTone = pnl > 0 ? "text-[var(--neon-green)]/80" : pnl < 0 ? "text-[var(--neon-red)]/80" : "text-foreground";
  return (
    <div className="shrink-0 border-t border-[var(--hairline-strong)] bg-black px-4 py-3">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <span>Win rate</span>
        <span className="tabular-nums text-foreground">{wr === null ? "n/a" : `${wr}%`}</span>
      </div>
      <div className="mt-1.5 h-1 w-full bg-[var(--hairline)]">
        <div className="h-full bg-[var(--neon-cyan)]" style={{ width: `${wr ?? 0}%` }} aria-hidden />
      </div>
      <div className="mt-2 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <span>Paper P/L · {headline.trades} trades</span>
        <span className={`tabular-nums ${pnlTone}`}>{`${pnl >= 0 ? "+" : "-"}$${Math.abs(pnl).toFixed(2)}`}</span>
      </div>
    </div>
  );
}

/**
 * Full-bleed trading terminal for the public flagship. Three rails
 * (20 / 60 / 22): watchlist + identity, chart + tabbed activity, the
 * workflow viewer (live state + cycle pipeline) + a neutral paper-mode
 * readout. Only the inner panels scroll; the page itself does not.
 */
export function FlagshipDashboard({ username, identity, watching, chartEndpoint, tradeRows, closedTrades, positions, headline }: {
  username: string;
  identity: FlagshipIdentity;
  watching: string[];
  chartEndpoint: string;
  tradeRows: BacktestTradeRow[];
  closedTrades: ClosedTradeView[];
  positions: PositionView[];
  headline: Headline;
}) {
  const pos0 = positions[0] ? { side: positions[0].side, asset: positions[0].asset } : null;

  return (
    <div className="grid grid-cols-1 gap-px bg-[var(--hairline)] lg:h-[calc(100dvh-7rem)] lg:grid-cols-[20%_minmax(0,1fr)_22%]">
      <aside className="min-h-[220px] lg:min-h-0 lg:overflow-hidden">
        <FlagshipWatchlist username={username} identity={identity} watching={watching} />
      </aside>

      <div className="flex flex-col gap-px lg:min-h-0 lg:overflow-hidden">
        <div className="h-[360px] lg:h-[48%] lg:min-h-0">
          <MarketChartCard watching={watching} endpoint={chartEndpoint} interactiveMarkers={false} defaultInterval="1h" defaultLookbackMs={2_592_000_000} />
        </div>
        <div className="h-[440px] lg:h-auto lg:min-h-0 lg:flex-1">
          <ActivityTabs username={username} tradeRows={tradeRows} closedTrades={closedTrades} positions={positions} />
        </div>
      </div>

      <aside className="flex flex-col gap-px bg-black lg:min-h-0 lg:overflow-hidden">
        <div className="min-h-[340px] lg:min-h-0 lg:flex-1 lg:overflow-hidden">
          <WorkflowViewer username={username} position={pos0} />
        </div>
        <StatReadout headline={headline} />
      </aside>
    </div>
  );
}
