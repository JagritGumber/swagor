import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ensureSelboInstance } from "@/app/services/selbo-instance.service";
import { listOpenPositions } from "@/app/services/positions.service";
import { MarketChartCard } from "@/components/dashboard/market-chart-card";
import { PositionsTable } from "@/components/dashboard/positions-table";
import { SelboAccount } from "@/components/dashboard/bento/selbo-account";
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

  // Layout per user direction:
  //   Top row: Selbo's account (4) | Market chart (8)
  //   Below:   Positions (12)
  // Strategy chat + Memory have been removed from this page; planned to
  // live in a separate tab. See user note 2026-05-16.
  return (
    <div className="mx-auto max-w-7xl pb-24">
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12 lg:col-span-4"><SelboAccount /></div>
        <div className="col-span-12 lg:col-span-8"><MarketChartCard watching={watching} admin={admin} /></div>
        <div className="col-span-12"><PositionsTable positions={positions} /></div>
      </div>
    </div>
  );
}
