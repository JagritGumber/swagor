import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { redirect } from "next/navigation";
import { ensureSolonInstance } from "@/app/services/solon-instance.service";
import { DecisionsSection } from "@/components/dashboard/decisions-section";
import { GoalForm } from "@/components/dashboard/goal-form";
import { KillSwitchCard } from "@/components/dashboard/kill-switch-card";
import { SolonWalletCard } from "@/components/dashboard/solon-wallet-card";
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
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <SolonWalletCard instance={instance} />
      <GoalForm walletAddress={addr} initialStrategy={instance.strategyText} />
      <DecisionsSection walletAddress={addr} />
      <KillSwitchCard initialActive={instance.killSwitchActive} />
      {isDev && <WatchingStripDev />}
    </div>
  );
}
