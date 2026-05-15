import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ensureSelboInstance } from "@/app/services/selbo-instance.service";
import { listOpenPositions } from "@/app/services/positions.service";
import { listClosedTrades, getLifetimeStats } from "@/app/services/trades.service";
import { DecisionsSection } from "@/components/dashboard/decisions-section";
import { TradeHistory } from "@/components/dashboard/trade-history";
import { LifetimeStats } from "@/components/dashboard/lifetime-stats";
import { MarketChartCard } from "@/components/dashboard/market-chart-card";
import { PositionsTable } from "@/components/dashboard/positions-table";
import { WatchingStrip } from "@/components/dashboard/watching-strip";
import { ActivityTape } from "@/components/dashboard/activity-tape";
import { ArcActivityCard } from "@/components/dashboard/arc-activity-card";
import { RiskStatusCard } from "@/components/dashboard/risk-status-card";
import { StrategyBriefCard } from "@/components/dashboard/strategy-brief-card";
import { WatcherDevControls } from "@/components/dashboard/watcher-dev-controls";
import { BetaGate } from "@/components/dashboard/beta-gate";
import { isAdmin } from "@/lib/auth/admin";

type SearchParams = Promise<{ dev?: string }>;

const DEV_TRUTHY = new Set(["1", "true", "yes", "on"]);

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const user = session.user;

  const instance = await ensureSelboInstance(user.id);
  // Mandatory wallet-verification gate. Users who signed up before this
  // landed have a NULL external_wallet_address and get routed to verify.
  if (!instance.externalWalletAddress) {
    redirect("/verify-wallet");
  }
  const addr = instance.circleWalletAddress;
  const devParam = (await searchParams).dev?.toLowerCase() ?? "";
  // Dev strip auto-shows locally; in prod requires ?dev=1 / true / yes.
  const isDev = process.env.NODE_ENV !== "production" || DEV_TRUTHY.has(devParam);

  // Private-beta gate: until the user redeems a code, render only the
  // gate component. No watcher feed, no market chart, no positions --
  // and no client polling that would generate Worker invocations.
  if (!instance.betaAccessGranted) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 pb-24">
        <BetaGate />
      </div>
    );
  }

  const [positions, closedTrades, lifetime] = await Promise.all([
    listOpenPositions(user.id),
    listClosedTrades(user.id, 20),
    getLifetimeStats(user.id),
  ]);
  const watching = instance.currentlyWatching ?? ["ETH", "BTC", "SOL"];
  const admin = isAdmin(user.email);

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <ActivityTape />
      <RiskStatusCard />
      <StrategyBriefCard strategy={instance.strategyText} watching={watching} />
      <WatchingStrip strategy={instance.strategyText} admin={admin} />
      {isDev && <WatcherDevControls />}
      <PositionsTable positions={positions} />
      <TradeHistory trades={closedTrades} admin={admin} />
      <MarketChartCard watching={watching} />
      <ArcActivityCard />
      <LifetimeStats stats={lifetime} />
      <DecisionsSection walletAddress={addr} />
    </div>
  );
}
