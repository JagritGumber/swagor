import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { redirect } from "next/navigation";
import { ensureSolonInstance } from "@/app/services/solon-instance.service";
import { ConnectedWalletCard } from "@/components/dashboard/connected-wallet-card";
import { CycleSection } from "@/components/dashboard/cycle-section";
import { GoalForm } from "@/components/dashboard/goal-form";
import { KillSwitchCard } from "@/components/dashboard/kill-switch-card";
import { PositionsCard } from "@/components/dashboard/positions-card";
import { SolonWalletCard } from "@/components/dashboard/solon-wallet-card";

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const instance = await ensureSolonInstance(user.id);
  const addr = instance.circleWalletAddress;

  return (
    <div className="mx-auto max-w-6xl px-2 pb-24 space-y-6">
      <div className="grid gap-px border border-[var(--hairline-strong)] bg-[var(--hairline-strong)] sm:grid-cols-2">
        <SolonWalletCard instance={instance} />
        <ConnectedWalletCard />
      </div>
      <GoalForm walletAddress={addr} />
      <PositionsCard walletAddress={addr} />
      <CycleSection walletAddress={addr} />
      <KillSwitchCard />
    </div>
  );
}
