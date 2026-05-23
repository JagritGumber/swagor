import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ensureSelboInstance } from "@/app/services/selbo-instance.service";
import { listOpenPositions } from "@/app/services/positions.service";
import { listClosedTrades, getLifetimeStats } from "@/app/services/trades.service";
import { getFeaturedBacktest } from "@/app/services/featured-backtest.service";
import { summarizeBacktestTrades } from "@/app/services/backtest/summarize-trades";
import { STARTING_EQUITY_USD } from "@/app/services/backtest/simulate-helpers";
import { FlagshipDashboard } from "@/components/public/flagship-dashboard";
import type { BacktestTradeRow } from "@/components/dashboard/bento/backtest-trades-table";
import type { BacktestTrade } from "@/lib/db/schema";
import { BetaGate } from "@/components/dashboard/beta-gate";
import { TosGate } from "@/components/legal/tos-gate";

function toRow(t: BacktestTrade): BacktestTradeRow {
  return {
    id: t.id, asset: t.asset, side: t.side,
    entryDate: t.entryDate.toISOString(), entryPrice: t.entryPrice,
    exitDate: t.exitDate ? t.exitDate.toISOString() : null, exitPrice: t.exitPrice,
    sizeUsd: t.sizeUsd, pnlUsd: t.pnlUsd, pnlPct: t.pnlPct,
    biasConfidence: t.biasConfidence, qualityScore: t.qualityScore, status: t.status, exitReason: t.exitReason,
    decisionReport: t.decisionReport,
  };
}

/**
 * The owner's dashboard IS the flagship terminal, pointed at the authed
 * session endpoints (same response shapes as the public ones): live
 * workflow stepper, watchlist, chart with markers, and one compact tabbed
 * panel. No text-wall pipeline, no duplicate growing activity lists.
 */
export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const user = session.user;

  const instance = await ensureSelboInstance(user.id);
  if (!instance.externalWalletAddress) redirect("/verify-wallet");
  if (!instance.tosAcceptedAt) {
    return <div className="mx-auto max-w-3xl space-y-6 pb-24"><TosGate /></div>;
  }
  if (!instance.betaAccessGranted) {
    return <div className="mx-auto max-w-3xl space-y-6 pb-24"><BetaGate /></div>;
  }

  const [positions, closedTrades, lifetime, featured] = await Promise.all([
    listOpenPositions(user.id),
    listClosedTrades(user.id, 50),
    getLifetimeStats(user.id),
    getFeaturedBacktest(instance.id),
  ]);
  const watching = instance.currentlyWatching ?? ["ETH", "BTC", "SOL"];
  const summary = featured ? summarizeBacktestTrades(featured.trades) : null;
  const tradeRows = featured ? featured.trades.map(toRow) : [];
  const headline = summary
    ? { trades: summary.totalTrades, winRate: summary.totalTrades > 0 ? summary.winRate : null, pnlUsd: summary.totalPnlUsd }
    : { trades: lifetime.closedTrades, winRate: lifetime.winRate, pnlUsd: lifetime.realizedPnlUsd };

  return (
    <FlagshipDashboard
      username={instance.username ?? user.id.slice(0, 8)}
      identity={{
        walletAddress: instance.circleWalletAddress,
        erc8004TokenId: instance.erc8004TokenId,
        erc8004RegistrationTxHash: instance.erc8004RegistrationTxHash,
        // Match the public profile's logic: when a featured backtest exists,
        // show the ending equity (start + realized PnL) instead of the raw
        // simulatedBalanceUsd default. Same instance must render the same
        // balance on both surfaces.
        balanceUsd: summary ? STARTING_EQUITY_USD + summary.totalPnlUsd : Number(instance.simulatedBalanceUsd),
      }}
      watching={watching}
      chartEndpoint="/api/chart-data"
      recentUrl="/api/watcher/recent"
      arcEndpoint="/api/arc/recent"
      tradeRows={tradeRows}
      closedTrades={closedTrades}
      positions={positions}
      headline={headline}
    />
  );
}
