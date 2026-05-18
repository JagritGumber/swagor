import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { selboInstances } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { listOpenPositions } from "@/app/services/positions.service";
import { listClosedTrades, getLifetimeStats } from "@/app/services/trades.service";
import { getFeaturedBacktest } from "@/app/services/featured-backtest.service";
import { MarketChartCard } from "@/components/dashboard/market-chart-card";
import { PositionsTable } from "@/components/dashboard/positions-table";
import { TradeHistory } from "@/components/dashboard/trade-history";
import { LifetimeStats } from "@/components/dashboard/lifetime-stats";
import { PublicWatchingStrip } from "@/components/public/public-watching-strip";
import { PublicDecisions } from "@/components/public/public-decisions";
import { PublicArcActivity } from "@/components/public/public-arc-activity";
import { PublicEquityCurve } from "@/components/public/public-equity-curve";
import { PublicSelboHeader } from "@/components/public/public-selbo-header";
import { FeaturedBacktestSections } from "@/components/public/featured-backtest-sections";

type Params = Promise<{ username: string }>;

/**
 * Public flagship Selbo profile. When the instance has a completed
 * backtest, surfaces its equity, trades, and anchored daily plans in
 * place of the live (and likely empty) equivalents so the hero CTA
 * lands on populated data. Otherwise falls back to the original live
 * sections.
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
    listClosedTrades(instance.userId, 20),
    getLifetimeStats(instance.userId),
    getFeaturedBacktest(instance.id),
  ]);
  const watching = instance.currentlyWatching ?? ["ETH", "BTC", "SOL"];

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24">
      <PublicSelboHeader username={username} instance={instance} />

      {featured ? (
        <FeaturedBacktestSections
          username={username}
          run={featured.run}
          trades={featured.trades}
          plans={featured.plans}
        />
      ) : (
        <>
          <LifetimeStats stats={lifetime} />
          <PublicEquityCurve username={username} />
        </>
      )}

      <PublicWatchingStrip username={username} />
      <PublicArcActivity username={username} />
      <MarketChartCard watching={watching} />
      <PositionsTable positions={positions} />

      {!featured && (
        <>
          <TradeHistory trades={closedTrades} />
          <PublicDecisions username={username} />
        </>
      )}
    </div>
  );
}
