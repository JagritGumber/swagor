import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ensureSelboInstance } from "@/app/services/selbo-instance.service";
import { BetaGate } from "@/components/dashboard/beta-gate";
import { TosGate } from "@/components/legal/tos-gate";

export default async function BrainPage() {
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

  return (
    <div className="mx-auto max-w-7xl pb-24">
      <section className="border border-[var(--hairline-strong)] bg-black">
        <header className="border-b border-[var(--hairline)] px-6 py-3">
          <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
            Brain
          </h2>
        </header>
        <div className="px-6 py-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Coming soon
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground">
            This is where you&apos;ll see what Selbo is doing right now: the
            current tick pipeline, recent activity, what each agent is
            reasoning about, and where the next decision is heading. We&apos;ll
            wire the live state in next.
          </p>
        </div>
      </section>
    </div>
  );
}
