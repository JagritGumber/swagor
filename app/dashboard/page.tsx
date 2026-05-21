import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ensureSelboInstance } from "@/app/services/selbo-instance.service";
import { listOpenPositions } from "@/app/services/positions.service";
import { MarketChartCard } from "@/components/dashboard/market-chart-card";
import { PositionsTable } from "@/components/dashboard/positions-table";
import { SelboAccount } from "@/components/dashboard/bento/selbo-account";
import { PipelineNow } from "@/components/dashboard/bento/pipeline-now";
import { StrategyChat } from "@/components/dashboard/bento/strategy-chat";
import { ActivityTape } from "@/components/dashboard/activity-tape";
import { MemoryCards } from "@/components/dashboard/bento/memory-cards";
import { ArcActivityCard } from "@/components/dashboard/arc-activity-card";
import { BetaGate } from "@/components/dashboard/beta-gate";
import { TosGate } from "@/components/legal/tos-gate";
import { isAdmin } from "@/lib/auth/admin";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const user = session.user;

  const instance = await ensureSelboInstance(user.id);
  if (!instance.externalWalletAddress) redirect("/verify-wallet");

  if (!instance.tosAcceptedAt) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 pb-24">
        <TosGate />
      </div>
    );
  }

  if (!instance.betaAccessGranted) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 pb-24">
        <BetaGate />
      </div>
    );
  }

  const positions = await listOpenPositions(user.id);
  const watching = instance.currentlyWatching ?? ["ETH", "BTC", "SOL"];
  const admin = isAdmin(user.email);

  // The product is decisions + on-chain proof, not profit. Order: live
  // decision pipeline -> what it just decided + what it follows -> those
  // decisions anchored on Arc -> what it learned -> positions -> paper
  // account/market context last.
  return (
    <div className="mx-auto max-w-7xl pb-24">
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12"><PipelineNow /></div>
        <div className="col-span-12 lg:col-span-7"><ActivityTape /></div>
        <div className="col-span-12 lg:col-span-5"><StrategyChat initialStrategy={instance.strategyText} watching={watching} /></div>
        <div className="col-span-12"><ArcActivityCard /></div>
        <section className="col-span-12 border border-[var(--hairline-strong)] bg-black p-6">
          <header className="flex items-baseline gap-3">
            <span aria-hidden className="inline-block h-2.5 w-2.5 bg-[var(--neon-cyan)]" />
            <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">What Selbo learned</h2>
          </header>
          <div className="mt-4"><MemoryCards /></div>
        </section>
        <div className="col-span-12"><PositionsTable positions={positions} /></div>
        <div className="col-span-12 lg:col-span-4"><SelboAccount /></div>
        <div className="col-span-12 lg:col-span-8"><MarketChartCard watching={watching} admin={admin} /></div>
      </div>
    </div>
  );
}
