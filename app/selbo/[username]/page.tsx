import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { selboInstances, type BacktestTrade } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { listOpenPositions } from "@/app/services/positions.service";
import { listClosedTrades, getLifetimeStats } from "@/app/services/trades.service";
import { getFeaturedBacktest } from "@/app/services/featured-backtest.service";
import { summarizeBacktestTrades } from "@/app/services/backtest/summarize-trades";
import { FlagshipDashboard } from "@/components/public/flagship-dashboard";
import type { BacktestTradeRow } from "@/components/dashboard/bento/backtest-trades-table";

type Params = Promise<{ username: string }>;

function toRow(t: BacktestTrade): BacktestTradeRow {
  return {
    id: t.id, asset: t.asset, side: t.side,
    entryDate: t.entryDate.toISOString(), entryPrice: t.entryPrice,
    exitDate: t.exitDate ? t.exitDate.toISOString() : null, exitPrice: t.exitPrice,
    sizeUsd: t.sizeUsd, pnlUsd: t.pnlUsd, pnlPct: t.pnlPct,
    biasConfidence: t.biasConfidence, status: t.status, exitReason: t.exitReason,
  };
}

/**
 * Public flagship Selbo profile: a full-bleed trading terminal. The page is
 * a thin server shell that loads the instance + its trades/positions/stats
 * (featured backtest when present, else live), then hands a single client
 * dashboard the serializable data. Layout, tabs, and live polling live in
 * FlagshipDashboard.
 */
export default async function PublicSelboPage({ params }: { params: Params }) {
  const { username } = await params;

  const [instance] = await db
    .select().from(selboInstances)
    .where(and(eq(selboInstances.username, username), eq(selboInstances.publicProfile, true)))
    .limit(1);
  if (!instance) notFound();

  const [positions, closedTrades, lifetime, featured] = await Promise.all([
    listOpenPositions(instance.userId),
    listClosedTrades(instance.userId, 50),
    getLifetimeStats(instance.userId),
    getFeaturedBacktest(instance.id),
  ]);

  const summary = featured ? summarizeBacktestTrades(featured.trades) : null;
  const tradeRows = featured ? featured.trades.map(toRow) : [];
  const headline = summary
    ? { trades: summary.totalTrades, winRate: summary.totalTrades > 0 ? summary.winRate : null, pnlUsd: summary.totalPnlUsd }
    : { trades: lifetime.closedTrades, winRate: lifetime.winRate, pnlUsd: lifetime.realizedPnlUsd };

  return (
    <FlagshipDashboard
      username={username}
      identity={{
        walletAddress: instance.circleWalletAddress,
        erc8004TokenId: instance.erc8004TokenId,
        erc8004RegistrationTxHash: instance.erc8004RegistrationTxHash,
        balanceUsd: Number(instance.simulatedBalanceUsd),
      }}
      watching={instance.currentlyWatching ?? ["ETH", "BTC", "SOL"]}
      chartEndpoint={`/api/public/selbo/${encodeURIComponent(username)}/chart-data`}
      tradeRows={tradeRows}
      closedTrades={closedTrades}
      positions={positions}
      headline={headline}
    />
  );
}
