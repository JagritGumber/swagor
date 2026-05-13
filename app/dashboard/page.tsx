import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { redirect } from "next/navigation";
import { ensureSolonInstance } from "@/app/services/solon-instance.service";
import { DecisionsSection } from "@/components/dashboard/decisions-section";
import { GoalForm } from "@/components/dashboard/goal-form";
import { KillSwitchCard } from "@/components/dashboard/kill-switch-card";
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

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <SolonWalletCard instance={instance} />
      {isDev && <WatchingStripDev />}
      <GoalForm walletAddress={addr} initialStrategy={instance.strategyText} />
      <DecisionsSection walletAddress={addr} />
      <KillSwitchCard initialActive={instance.killSwitchActive} />
    </div>
  );
}
