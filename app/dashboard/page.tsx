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

  // "Agent working in front of me" order: live workflow first, then what
  // it's following, what it just decided, what it has learned, then the
  // account/market context. Profit is not the headline.
  return (
    <div className="mx-auto max-w-7xl pb-24">
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12"><PipelineNow /></div>
        <div className="col-span-12 lg:col-span-5"><StrategyChat initialStrategy={instance.strategyText} watching={watching} /></div>
        <div className="col-span-12 lg:col-span-7"><ActivityTape /></div>
        <div className="col-span-12"><MemoryCards /></div>
        <div className="col-span-12"><PositionsTable positions={positions} /></div>
        <div className="col-span-12 lg:col-span-4"><SelboAccount /></div>
        <div className="col-span-12 lg:col-span-8"><MarketChartCard watching={watching} admin={admin} /></div>
        <div className="col-span-12"><ArcActivityCard /></div>
      </div>
    </div>
  );
}
