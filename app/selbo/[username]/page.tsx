import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { db } from "@/lib/db/client";
import { selboInstances } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { listOpenPositions } from "@/app/services/positions.service";
import { listClosedTrades, getLifetimeStats } from "@/app/services/trades.service";
import { MarketChartCard } from "@/components/dashboard/market-chart-card";
import { PositionsTable } from "@/components/dashboard/positions-table";
import { TradeHistory } from "@/components/dashboard/trade-history";
import { LifetimeStats } from "@/components/dashboard/lifetime-stats";
import { PublicWatchingStrip } from "@/components/public/public-watching-strip";
import { PublicDecisions } from "@/components/public/public-decisions";

type Params = Promise<{ username: string }>;

const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
const ARCSCAN = "https://testnet.arcscan.app/address/";

/**
 * Public flagship Selbo profile. Reachable at /selbo/{username} for any
 * selbo_instance that has public_profile=true and a username set. Anonymous
 * visitors can see: equity, strategy, market chart with trade markers,
 * open positions. Strategy and kill switch are read-only. Recent
 * deliberations are hidden until the read API supports public access.
 */
export default async function PublicSelboPage({ params }: { params: Params }) {
  const { username } = await params;

  const [instance] = await db
    .select()
    .from(selboInstances)
    .where(and(eq(selboInstances.username, username), eq(selboInstances.publicProfile, true)))
    .limit(1);

  if (!instance) notFound();

  const [positions, closedTrades, lifetime] = await Promise.all([
    listOpenPositions(instance.userId),
    listClosedTrades(instance.userId, 20),
    getLifetimeStats(instance.userId),
  ]);
  const watching = instance.currentlyWatching ?? ["ETH", "BTC", "SOL"];
  const balance = Number(instance.simulatedBalanceUsd);

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24">
      <header className="border border-[var(--hairline-strong)] bg-black p-8">
        <div className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--neon-cyan)]">
          Public Selbo · {username}
        </div>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Equity
            </div>
            <div className="mt-1 font-mono text-4xl tabular-nums text-foreground">
              ${balance.toFixed(2)}
            </div>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <a
                href={`${ARCSCAN}${instance.circleWalletAddress}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-sm text-[var(--neon-cyan)] underline-offset-4 hover:underline"
              >
                {truncate(instance.circleWalletAddress)}
                <ArrowUpRight aria-hidden className="h-3.5 w-3.5 opacity-70" />
              </a>
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Arc Testnet
              </span>
            </div>
          </div>
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Watching
            </div>
            <div className="mt-1 font-mono text-base text-foreground">
              {watching.join(", ")}
            </div>
            <div className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Strategy
            </div>
            <p className="mt-1 text-sm text-foreground line-clamp-3">
              {instance.strategyText}
            </p>
          </div>
        </div>
      </header>

      <LifetimeStats stats={lifetime} />

      <PublicWatchingStrip username={username} />

      <MarketChartCard watching={watching} />

      <PositionsTable positions={positions} />

      <TradeHistory trades={closedTrades} />

      <PublicDecisions username={username} />
    </div>
  );
}
