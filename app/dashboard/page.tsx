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
import { MarketStateCard } from "@/components/dashboard/market-state-card";
import { PositionsTable } from "@/components/dashboard/positions-table";
import { ActivityTape } from "@/components/dashboard/activity-tape";
import { ArcActivityCard } from "@/components/dashboard/arc-activity-card";
import { RiskStatusCard } from "@/components/dashboard/risk-status-card";
import { StrategyBriefCard } from "@/components/dashboard/strategy-brief-card";
import { WatcherDevControls } from "@/components/dashboard/watcher-dev-controls";
import { DisclosureCard } from "@/components/dashboard/disclosure-card";
import { BetaGate } from "@/components/dashboard/beta-gate";
import { isAdmin } from "@/lib/auth/admin";

type SearchParams = Promise<{ dev?: string }>;

const DEV_TRUTHY = new Set(["1", "true", "yes", "on"]);

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const user = session.user;

  const instance = await ensureSelboInstance(user.id);
  if (!instance.externalWalletAddress) redirect("/verify-wallet");
  const addr = instance.circleWalletAddress;
  const devParam = (await searchParams).dev?.toLowerCase() ?? "";
  const isDev = process.env.NODE_ENV !== "production" || DEV_TRUTHY.has(devParam);

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
    <div className="mx-auto max-w-7xl pb-24">
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12 lg:col-span-8"><ActivityTape /></div>
        <div className="col-span-12 lg:col-span-4"><RiskStatusCard /></div>

        <div className="col-span-12 lg:col-span-8"><MarketChartCard watching={watching} /></div>
        <div className="col-span-12 lg:col-span-4"><MarketStateCard /></div>

        <div className="col-span-12 lg:col-span-6">
          <StrategyBriefCard strategy={instance.strategyText} watching={watching} />
        </div>
        <div className="col-span-12 lg:col-span-6"><PositionsTable positions={positions} /></div>

        <div className="col-span-12">
          <DisclosureCard title="Trade history" subtitle={`${closedTrades.length} closed`}>
            <TradeHistory trades={closedTrades} admin={admin} />
          </DisclosureCard>
        </div>

        <div className="col-span-12 lg:col-span-6">
          <DisclosureCard title="Arc anchors">
            <ArcActivityCard />
          </DisclosureCard>
        </div>
        <div className="col-span-12 lg:col-span-6">
          <DisclosureCard title="Lifetime stats">
            <LifetimeStats stats={lifetime} />
          </DisclosureCard>
        </div>

        <div className="col-span-12">
          <DisclosureCard title="Decisions">
            <DecisionsSection walletAddress={addr} />
          </DisclosureCard>
        </div>

        {isDev && (
          <div className="col-span-12">
            <DisclosureCard title="Dev controls" subtitle="admin">
              <WatcherDevControls />
            </DisclosureCard>
          </div>
        )}
      </div>
    </div>
  );
}
