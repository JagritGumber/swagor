type Aggregated = {
  decision?: string;
  regime_assessment?: string;
  rationale?: string;
  dispersion?: number;
  swarmSize?: number;
  decisionCounts?: Record<string, number>;
  keyDrivers?: string[];
  if_rotate?: { from: string; to: string; percent_of_portfolio: number };
  safety_layer?: { stop_loss_trigger: string; take_profit_trigger: string; rebalance_trigger: string };
};

type Member = { personaId: string; decision: string; rationale: string; confidence?: number };

export function SwarmSection({ aggregated, swarm }: { aggregated: Aggregated | undefined; swarm: Member[] | undefined }) {
  if (!aggregated) return null;
  const swarmCount = aggregated.swarmSize ?? swarm?.length ?? 0;

  return (
    <section className="border border-[var(--hairline-strong)] bg-black p-6 space-y-5">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Panel</div>
          <h2 className="mt-3 text-2xl font-bold uppercase leading-tight text-foreground">Consensus</h2>
        </div>
        <div className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
          {swarmCount} agents · dispersion {typeof aggregated.dispersion === "number" ? aggregated.dispersion.toFixed(2) : "—"}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Decision" value={aggregated.decision} accent />
        <Field label="Regime" value={aggregated.regime_assessment} />
      </div>

      {aggregated.rationale && <p className="text-base text-foreground">{aggregated.rationale}</p>}

      {aggregated.if_rotate && (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Proposed move</div>
          <p className="mt-1 font-mono text-sm text-foreground">
            {aggregated.if_rotate.percent_of_portfolio}% from {aggregated.if_rotate.from} → {aggregated.if_rotate.to}
          </p>
        </div>
      )}

      {aggregated.decisionCounts && (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Vote distribution</div>
          <ul className="mt-2 space-y-1 font-mono text-xs">
            {Object.entries(aggregated.decisionCounts).map(([k, n]) => <li key={k}>{k}: {n}</li>)}
          </ul>
        </div>
      )}

      {Array.isArray(swarm) && swarm.length > 0 && (
        <details className="border-t border-[var(--hairline)] pt-4">
          <summary className="cursor-pointer font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">
            Per-agent reasoning ({swarm.length})
          </summary>
          <div className="mt-4 space-y-3">
            {swarm.map((m, i) => (
              <div key={i} className="border border-[var(--hairline)] bg-[#080808] p-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-xs text-foreground">{m.personaId}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {m.decision}{typeof m.confidence === "number" ? ` · conf ${m.confidence.toFixed(2)}` : ""}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{m.rationale}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function Field({ label, value, accent }: { label: string; value?: string; accent?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-base uppercase ${accent ? "text-[var(--neon-cyan)]" : "text-foreground"}`}>
        {value ?? "—"}
      </div>
    </div>
  );
}
