import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ensureSelboInstance } from "@/app/services/selbo-instance.service";
import { listOpenPositions } from "@/app/services/positions.service";
import { getLifetimeStats } from "@/app/services/trades.service";
import { PortfolioDashboard } from "@/components/portfolio/portfolio-dashboard";
import { BetaGate } from "@/components/dashboard/beta-gate";
import { TosGate } from "@/components/legal/tos-gate";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const user = session.user;

  const instance = await ensureSelboInstance(user.id);
  if (!instance.externalWalletAddress) redirect("/verify-wallet");
  if (!instance.tosAcceptedAt) {
    return <div className="mx-auto max-w-3xl space-y-6 pb-24"><TosGate /></div>;
  }
  if (!instance.betaAccessGranted) {
    return <div className="mx-auto max-w-3xl space-y-6 pb-24"><BetaGate /></div>;
  }

  const [positions, lifetime] = await Promise.all([
    listOpenPositions(user.id),
    getLifetimeStats(user.id),
  ]);
  const watching = instance.currentlyWatching ?? ["ETH", "BTC", "SOL"];
  const balanceUsd = Number(instance.simulatedBalanceUsd);

  return (
    <PortfolioDashboard
      username={instance.username ?? user.id.slice(0, 8)}
      balanceUsd={balanceUsd}
      lifetime={lifetime}
      positions={positions}
      watching={watching}
    />
  );
}
