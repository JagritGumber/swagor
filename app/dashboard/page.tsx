import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ensureSelboInstance } from "@/app/services/selbo-instance.service";
import { listOpenPositions } from "@/app/services/positions.service";
import { listClosedTrades, getLifetimeStats } from "@/app/services/trades.service";
import { DecisionsSection } from "@/components/dashboard/decisions-section";
import { TradeHistory } from "@/components/dashboard/trade-history";
import { LifetimeStats } from "@/components/dashboard/lifetime-stats";
import { GoalForm } from "@/components/dashboard/goal-form";
import { KillSwitchCard } from "@/components/dashboard/kill-switch-card";
import { MarketChartCard } from "@/components/dashboard/market-chart-card";
import { PositionsTable } from "@/components/dashboard/positions-table";
import { SelboWalletCard } from "@/components/dashboard/selbo-wallet-card";
import { WatchingStrip } from "@/components/dashboard/watching-strip";
import { ArcActivityCard } from "@/components/dashboard/arc-activity-card";
import { WatcherDevControls } from "@/components/dashboard/watcher-dev-controls";
import { ProfileSettings } from "@/components/dashboard/profile-settings";
import { BetaGate } from "@/components/dashboard/beta-gate";

type SearchParams = Promise<{ dev?: string }>;

const DEV_TRUTHY = new Set(["1", "true", "yes", "on"]);

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const user = session.user;

  const instance = await ensureSelboInstance(user.id);
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

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <SelboWalletCard instance={instance} />
      <LifetimeStats stats={lifetime} />
      <WatchingStrip />
      {isDev && <WatcherDevControls />}
      <ArcActivityCard />
      <MarketChartCard watching={watching} />
      <PositionsTable positions={positions} />
      <TradeHistory trades={closedTrades} />
      <GoalForm walletAddress={addr} initialStrategy={instance.strategyText} />
      <DecisionsSection walletAddress={addr} />
      <ProfileSettings initialUsername={instance.username ?? null} initialPublic={instance.publicProfile} />
      <KillSwitchCard initialActive={instance.killSwitchActive} />
    </div>
  );
}
