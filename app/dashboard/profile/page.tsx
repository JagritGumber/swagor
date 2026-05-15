import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ensureSelboInstance } from "@/app/services/selbo-instance.service";
import { ProfileSettings } from "@/components/dashboard/profile-settings";
import { SelboWalletCard } from "@/components/dashboard/selbo-wallet-card";
import { GoalForm } from "@/components/dashboard/goal-form";
import { KillSwitchCard } from "@/components/dashboard/kill-switch-card";

/**
 * Profile + settings hub. Holds everything that is not "what Selbo is doing
 * right now" so the dashboard stays focused on live decisions and risk.
 *
 * Order:
 *   1. Identity (username + public profile toggle)
 *   2. Strategy (the text the watcher and trader read every tick)
 *   3. Wallet (Selbo's Arc Testnet wallet)
 *   4. Kill switch (danger zone at the bottom)
 */
export default async function ProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const instance = await ensureSelboInstance(session.user.id);
  if (!instance.externalWalletAddress) redirect("/verify-wallet");
  const addr = instance.circleWalletAddress;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-[var(--neon-cyan)]"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
        Back to dashboard
      </Link>

      <header className="border border-[var(--hairline-strong)] bg-black p-6">
        <div className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Account
        </div>
        <h1 className="mt-3 text-3xl font-bold uppercase leading-tight text-foreground">
          Profile and settings
        </h1>
      </header>

      <ProfileSettings
        initialUsername={instance.username ?? null}
        initialPublic={instance.publicProfile}
      />

      <GoalForm
        walletAddress={addr}
        initialStrategy={instance.strategyText}
      />

      <SelboWalletCard instance={instance} />

      <KillSwitchCard initialActive={instance.killSwitchActive} />
    </div>
  );
}
