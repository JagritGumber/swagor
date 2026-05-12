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
    <div className="mx-auto max-w-6xl px-2 pb-24 pt-2">
      <header className="border-b border-[var(--hairline-strong)] pb-6">
        <div className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--neon-cyan)]">
          your solon
        </div>
        <h1 className="mt-2 text-[40px] font-bold uppercase leading-tight tracking-tight text-foreground">
          Control room
        </h1>
        <p className="mt-3 max-w-2xl text-base text-muted-foreground">
          Set the strategy. Watch the cycles. Pull the kill switch any time.
        </p>
      </header>

      <div className="grid gap-px bg-[var(--hairline-strong)] sm:grid-cols-2 mt-8">
        <div className="bg-black"><ConnectedWalletCard /></div>
        <div className="bg-black"><KillSwitchCard /></div>
      </div>

      <div className="mt-8"><GoalForm /></div>
      <div className="mt-8"><PositionsCard /></div>
      <div className="mt-8"><CycleSection /></div>
    </div>
  );
}
