import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { redirect } from "next/navigation";
import { ensureSolonInstance } from "@/app/services/solon-instance.service";
import { ConnectedWalletCard } from "@/components/dashboard/connected-wallet-card";
import { DecisionsSection } from "@/components/dashboard/decisions-section";
import { GoalForm } from "@/components/dashboard/goal-form";
import { KillSwitchCard } from "@/components/dashboard/kill-switch-card";
import { PositionsCard } from "@/components/dashboard/positions-card";
import { SolonWalletCard } from "@/components/dashboard/solon-wallet-card";
import { WatchingStatus } from "@/components/dashboard/watching-status";
import { WatchingStripDev } from "@/components/dashboard/watching-strip-dev";

type SearchParams = Promise<{ dev?: string }>;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const instance = await ensureSolonInstance(user.id);
  const addr = instance.circleWalletAddress;
  const isDev = (await searchParams).dev === "1";

  return (
    <div className="pb-24 space-y-6">
      <div className="grid gap-px border border-[var(--hairline)] bg-[var(--hairline-strong)] sm:grid-cols-2">
        <SolonWalletCard instance={instance} />
        <ConnectedWalletCard />
      </div>

      <WatchingStatus initialWatching={instance.currentlyWatching ?? ["ETH", "BTC", "SOL"]} />

      <GoalForm walletAddress={addr} />
      <PositionsCard walletAddress={addr} />
      <DecisionsSection walletAddress={addr} />

      {isDev && <WatchingStripDev />}

      <KillSwitchCard />
    </div>
  );
}
