import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { redirect } from "next/navigation";
import { ConnectedWalletCard } from "@/components/dashboard/connected-wallet-card";
import { CycleSection } from "@/components/dashboard/cycle-section";
import { GoalForm } from "@/components/dashboard/goal-form";
import { KillSwitchCard } from "@/components/dashboard/kill-switch-card";
import { PositionsCard } from "@/components/dashboard/positions-card";

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  return (
    <div className="mx-auto max-w-6xl px-2 pb-24 space-y-6">
      <ConnectedWalletCard />
      <GoalForm />
      <PositionsCard />
      <CycleSection />
      <KillSwitchCard />
    </div>
  );
}
