import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import {
  getCycleById,
  getAgentReasoningForCycle,
  getPortfolioById,
} from "@/app/services/portfolio.service";

export default async function CycleTracePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const cycle = await getCycleById(params.id);
  if (!cycle) notFound();

  const portfolio = cycle.portfolioId
    ? await getPortfolioById(cycle.portfolioId)
    : null;

  // Authorize: user can only view their own cycles
  if (portfolio?.userId !== user.id) notFound();

  const reasoning = await getAgentReasoningForCycle(cycle.id);
  const cycleState = (cycle.cycleState as any) ?? {};
  const swarm = cycleState.swarm as any[] | undefined;
  const aggregated = cycleState.aggregated;
  const taxOpt = cycleState.taxOptimizer;
  const decision = aggregated ?? cycleState.decision; // backward-compat with pre-swarm cycles
  const verdict = cycleState.verdict;
  const context = cycleState.context;
  const arcAnchor = cycleState.arcAnchor;

  return (
    <div className="flex flex-col gap-6 p-8 max-w-4xl">
      <Link
        href="/dashboard"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to dashboard
      </Link>

      <header>
        <h1 className="text-2xl font-bold">Cycle trace</h1>
        <p className="text-xs text-muted-foreground font-mono mt-1">{cycle.id}</p>
      </header>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="rounded border p-3">
          <div className="text-xs text-muted-foreground">Status</div>
          <div className="font-medium mt-1">{cycle.status}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs text-muted-foreground">Started</div>
          <div className="text-xs mt-1">
            {new Date(cycle.startedAt).toLocaleString()}
          </div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs text-muted-foreground">Completed</div>
          <div className="text-xs mt-1">
            {cycle.completedAt
              ? new Date(cycle.completedAt).toLocaleString()
              : "—"}
          </div>
        </div>
      </div>

      {aggregated && (
        <section className="rounded-lg border p-6 space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Swarm consensus</h2>
            <span className="text-xs text-muted-foreground font-mono">
              {aggregated.swarmSize ?? swarm?.length ?? 0} agents · dispersion{" "}
              {typeof aggregated.dispersion === "number"
                ? aggregated.dispersion.toFixed(2)
                : "—"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Decision</div>
              <div className="font-medium">{aggregated.decision}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Regime</div>
              <div className="font-medium">{aggregated.regime_assessment}</div>
            </div>
          </div>

          <p className="text-sm">{aggregated.rationale}</p>

          {aggregated.if_rotate && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                Proposed rotation
              </div>
              <p className="text-sm font-mono">
                {aggregated.if_rotate.percent_of_portfolio}% from{" "}
                {aggregated.if_rotate.from} → {aggregated.if_rotate.to}
              </p>
            </div>
          )}

          {aggregated.decisionCounts && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                Vote distribution
              </div>
              <ul className="text-xs space-y-1 font-mono">
                {Object.entries(aggregated.decisionCounts as Record<string, number>).map(
                  ([k, n]) => (
                    <li key={k}>
                      {k}: {n}
                    </li>
                  ),
                )}
              </ul>
            </div>
          )}

          {Array.isArray(aggregated.keyDrivers) && aggregated.keyDrivers.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Key drivers</div>
              <ul className="text-xs space-y-1">
                {aggregated.keyDrivers.map((d: string, i: number) => (
                  <li key={i} className="break-words">
                    · {d}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {aggregated.safety_layer && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                Safety layer (agent-set tools)
              </div>
              <ul className="text-xs space-y-1 font-mono">
                <li>stop-loss: {aggregated.safety_layer.stop_loss_trigger}</li>
                <li>take-profit: {aggregated.safety_layer.take_profit_trigger}</li>
                <li>rebalance: {aggregated.safety_layer.rebalance_trigger}</li>
              </ul>
            </div>
          )}
        </section>
      )}

      {Array.isArray(swarm) && swarm.length > 0 && (
        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Per-persona swarm votes ({swarm.length})
          </summary>
          <div className="mt-3 space-y-2">
            {swarm.map((m: any, i: number) => (
              <div key={i} className="text-xs bg-muted/30 p-3 rounded">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="font-medium font-mono">{m.personaId}</span>
                  <span className="text-muted-foreground">
                    {m.decision}
                    {typeof m.confidence === "number"
                      ? ` · conf ${m.confidence.toFixed(2)}`
                      : ""}
                  </span>
                </div>
                <p className="text-xs">{m.rationale}</p>
                {m.if_rotate && (
                  <p className="text-xs font-mono mt-1 text-muted-foreground">
                    → {m.if_rotate.percent_of_portfolio}% {m.if_rotate.from} →{" "}
                    {m.if_rotate.to}
                  </p>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      {taxOpt && (
        <section className="rounded-lg border p-6 space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Tax lens (Indian VDA)</h2>
            <span className="text-xs text-muted-foreground font-mono">
              cross-model audit
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Approved decision</div>
              <div className="font-medium">{taxOpt.approved_decision}</div>
            </div>
            {typeof taxOpt.tax_impact?.after_tax_apy_delta_pct === "number" && (
              <div>
                <div className="text-xs text-muted-foreground">After-tax APY delta</div>
                <div className="font-medium">
                  {taxOpt.tax_impact.after_tax_apy_delta_pct.toFixed(2)}%
                </div>
              </div>
            )}
          </div>
          <p className="text-sm">{taxOpt.rationale}</p>
          {taxOpt.tax_impact && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Estimated tax cost</div>
              <ul className="text-xs space-y-1 font-mono">
                <li>
                  capital gains (30% flat + 4% cess): $
                  {Number(taxOpt.tax_impact.capital_gains_tax_usd ?? 0).toFixed(2)}
                </li>
                <li>
                  TDS (1% per transfer): $
                  {Number(taxOpt.tax_impact.tds_usd ?? 0).toFixed(2)}
                </li>
                <li>
                  total: $
                  {Number(taxOpt.tax_impact.total_tax_cost_usd ?? 0).toFixed(2)}
                </li>
              </ul>
            </div>
          )}
          {taxOpt.modifications && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Modifications</div>
              <p className="text-sm">{taxOpt.modifications}</p>
            </div>
          )}
          {taxOpt.india_specific_flags && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">India-specific flags</div>
              <ul className="text-xs space-y-1">
                {taxOpt.india_specific_flags.no_loss_offset_warning && (
                  <li>· No loss offset (Section 115BBH): losses cannot reduce other VDA gains</li>
                )}
                {taxOpt.india_specific_flags.high_frequency_tds_drag && (
                  <li>· High-frequency TDS drag: cumulative 1% TDS eroding returns</li>
                )}
                {taxOpt.india_specific_flags.cost_basis_uncertainty && (
                  <li>· Cost basis not tracked yet — tax estimate is upper bound</li>
                )}
              </ul>
            </div>
          )}
        </section>
      )}

      {!aggregated && decision && (
        <section className="rounded-lg border p-6 space-y-3">
          <h2 className="text-lg font-semibold">Decider (legacy single-agent)</h2>
          <p className="text-xs text-muted-foreground">
            Pre-swarm cycle. Re-run for swarm output.
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Decision</div>
              <div className="font-medium">{decision.decision}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Regime</div>
              <div className="font-medium">{decision.regime_assessment}</div>
            </div>
          </div>
          <p className="text-sm">{decision.rationale}</p>
        </section>
      )}

      {verdict && (
        <section className="rounded-lg border p-6 space-y-3">
          <h2 className="text-lg font-semibold">Critic</h2>
          <div>
            <div className="text-xs text-muted-foreground">Verdict</div>
            <div className="font-medium">{verdict.verdict}</div>
          </div>
          {verdict.concerns?.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Concerns</div>
              <ul className="text-sm list-disc list-inside space-y-1">
                {verdict.concerns.map((c: string, i: number) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {verdict.suggested_modification && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Suggested modification</div>
              <p className="text-sm">{verdict.suggested_modification}</p>
            </div>
          )}
        </section>
      )}

      {arcAnchor && (
        <section className="rounded-lg border p-6 space-y-2">
          <h2 className="text-lg font-semibold">Anchored on Arc</h2>
          <div className="text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">Contract:</span>{" "}
              <code className="text-xs">{arcAnchor.contractAddress}</code>
            </p>
            <p>
              <span className="text-muted-foreground">Circle tx id:</span>{" "}
              <code className="text-xs">{arcAnchor.txId}</code>
            </p>
            <p>
              <span className="text-muted-foreground">Cycle id (bytes32):</span>{" "}
              <code className="text-xs">{arcAnchor.cycleIdBytes32}</code>
            </p>
            <p>
              <span className="text-muted-foreground">Trace hash (sha256):</span>{" "}
              <code className="text-xs break-all">{arcAnchor.swarmTraceHash}</code>
            </p>
          </div>
        </section>
      )}

      {context && (
        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Cycle context (positions + goal + market data)
          </summary>
          <pre className="mt-3 text-xs bg-muted/30 p-3 rounded overflow-x-auto">
            {JSON.stringify(context, null, 2)}
          </pre>
        </details>
      )}

      {reasoning.length > 0 && (
        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Raw agent_reasoning rows ({reasoning.length})
          </summary>
          <div className="mt-3 space-y-3">
            {reasoning.map((r) => (
              <div key={r.id} className="text-xs bg-muted/30 p-3 rounded">
                <div className="font-medium mb-1">
                  {r.agentName} ({r.model})
                </div>
                <pre className="overflow-x-auto">
                  {JSON.stringify(r.output, null, 2)}
                </pre>
                <div className="mt-2 text-muted-foreground">
                  tokens in: {r.promptTokens ?? "—"} · out: {r.completionTokens ?? "—"}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
