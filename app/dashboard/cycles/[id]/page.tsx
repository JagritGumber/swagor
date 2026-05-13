import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { getCycleById, getPortfolioById } from "@/app/services/portfolio.service";
import { getWatcherTriggerForCycle } from "@/app/services/cycle-trace.service";
import { TriggerSection } from "@/components/dashboard/cycle/trigger-section";
import { SwarmSection } from "@/components/dashboard/cycle/swarm-section";
import { TaxSection } from "@/components/dashboard/cycle/tax-section";
import { CriticSection } from "@/components/dashboard/cycle/critic-section";
import { ArcAnchorSection } from "@/components/dashboard/cycle/arc-anchor-section";

type Params = Promise<{ id: string }>;

export default async function CycleTracePage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const user = session.user;

  const cycle = await getCycleById(id);
  if (!cycle) notFound();

  const portfolio = cycle.portfolioId ? await getPortfolioById(cycle.portfolioId) : null;
  if (portfolio?.userId !== user.id) notFound();

  const trigger = await getWatcherTriggerForCycle({
    userId: user.id,
    cycleStartedAt: new Date(cycle.startedAt),
  });

  const cs = (cycle.cycleState as Record<string, unknown> | null) ?? {};
  const swarm = cs.swarm as Parameters<typeof SwarmSection>[0]["swarm"];
  const aggregated = cs.aggregated as Parameters<typeof SwarmSection>[0]["aggregated"];
  const taxOpt = cs.taxOptimizer as Parameters<typeof TaxSection>[0]["taxOpt"];
  const verdict = cs.verdict as Parameters<typeof CriticSection>[0]["verdict"];
  const arcAnchor = cs.arcAnchor as Parameters<typeof ArcAnchorSection>[0]["anchor"];

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
        <div className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Cycle trace</div>
        <h1 className="mt-3 text-3xl font-bold uppercase leading-tight text-foreground">
          {cycle.status}
        </h1>
        <div className="mt-4 grid grid-cols-2 gap-4 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground sm:grid-cols-3">
          <div>
            <div className="text-[10px] tracking-[0.18em]">Cycle id</div>
            <code className="mt-1 block text-foreground normal-case tracking-normal">{cycle.id.slice(0, 8)}</code>
          </div>
          <div>
            <div className="text-[10px] tracking-[0.18em]">Started</div>
            <div className="mt-1 text-foreground normal-case tracking-normal">
              {new Date(cycle.startedAt).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-[10px] tracking-[0.18em]">Completed</div>
            <div className="mt-1 text-foreground normal-case tracking-normal">
              {cycle.completedAt ? new Date(cycle.completedAt).toLocaleString() : "—"}
            </div>
          </div>
        </div>
      </header>

      <TriggerSection tick={trigger} />
      <SwarmSection aggregated={aggregated} swarm={swarm} />
      <TaxSection taxOpt={taxOpt} />
      <CriticSection verdict={verdict} />
      <ArcAnchorSection anchor={arcAnchor} />
    </div>
  );
}
