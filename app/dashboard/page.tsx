import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { redirect } from "next/navigation";
import { ensureSolonInstance } from "@/app/services/solon-instance.service";
import { listOpenPositions } from "@/app/services/positions.service";
import { DecisionsSection } from "@/components/dashboard/decisions-section";
import { GoalForm } from "@/components/dashboard/goal-form";
import { KillSwitchCard } from "@/components/dashboard/kill-switch-card";
import { MarketChartCard } from "@/components/dashboard/market-chart-card";
import { PositionsTable } from "@/components/dashboard/positions-table";
import { SolonWalletCard } from "@/components/dashboard/solon-wallet-card";
import { WatchingStripDev } from "@/components/dashboard/watching-strip-dev";

type SearchParams = Promise<{ dev?: string }>;

const DEV_TRUTHY = new Set(["1", "true", "yes", "on"]);

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const instance = await ensureSolonInstance(user.id);
  const addr = instance.circleWalletAddress;
  const devParam = (await searchParams).dev?.toLowerCase() ?? "";
  // Dev strip auto-shows locally; in prod requires ?dev=1 / true / yes.
  const isDev = process.env.NODE_ENV !== "production" || DEV_TRUTHY.has(devParam);

  const positions = await listOpenPositions(user.id);
  const watching = instance.currentlyWatching ?? ["ETH", "BTC", "SOL"];
  const focusAsset = watching[0] ?? "ETH";

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <SolonWalletCard instance={instance} />
      {isDev && <WatchingStripDev />}
      <MarketChartCard asset={focusAsset} userId={user.id} />
      <PositionsTable positions={positions} />
      <GoalForm walletAddress={addr} initialStrategy={instance.strategyText} />
      <DecisionsSection walletAddress={addr} />
      <KillSwitchCard initialActive={instance.killSwitchActive} />
    </div>
  );
}
