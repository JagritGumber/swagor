import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { redirect } from "next/navigation";
import { ConnectedWalletCard } from "@/components/dashboard/connected-wallet-card";
import { CycleSection } from "@/components/dashboard/cycle-section";
import { GoalForm } from "@/components/dashboard/goal-form";
import { PositionsCard } from "@/components/dashboard/positions-card";

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <header>
        <h1 className="text-3xl font-bold">Swagora</h1>
        <p className="text-sm text-muted-foreground">
          AI swarm portfolio agent. Signed in as {user.email}.
        </p>
      </header>

      <ConnectedWalletCard />

      <PositionsCard />

      <GoalForm />

      <CycleSection />

      <section className="rounded-lg border border-dashed border-muted-foreground/30 p-8 text-center">
        <p className="text-muted-foreground">
          Position discovery, swarm reasoning, and trace pages land here as
          we build them.
        </p>
      </section>
    </div>
  );
}
