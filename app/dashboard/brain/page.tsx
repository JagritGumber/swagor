import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ensureSelboInstance } from "@/app/services/selbo-instance.service";
import { isAdmin } from "@/lib/auth/admin";
import { BetaGate } from "@/components/dashboard/beta-gate";
import { TosGate } from "@/components/legal/tos-gate";
import { DailyPlan } from "@/components/dashboard/bento/daily-plan";
import { SwarmDevPanel } from "@/components/dashboard/bento/swarm-dev-panel";

export default async function BrainPage() {
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

  const admin = isAdmin(user.email);

  return (
    <div className="mx-auto max-w-7xl space-y-4 pb-24">
      <DailyPlan />
      {admin && <SwarmDevPanel />}
    </div>
  );
}
