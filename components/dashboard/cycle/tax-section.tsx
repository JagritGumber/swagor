type TaxOpt = {
  approved_decision?: string;
  rationale?: string;
  modifications?: string;
  tax_impact?: {
    capital_gains_tax_usd?: number;
    tds_usd?: number;
    total_tax_cost_usd?: number;
    after_tax_apy_delta_pct?: number;
  };
  india_specific_flags?: {
    no_loss_offset_warning?: boolean;
    high_frequency_tds_drag?: boolean;
    cost_basis_uncertainty?: boolean;
  };
};

export function TaxSection({ taxOpt }: { taxOpt: TaxOpt | undefined }) {
  if (!taxOpt) return null;

  return (
    <section className="border border-[var(--hairline-strong)] bg-black p-6 space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Tax lens</div>
          <h2 className="mt-3 text-2xl font-bold uppercase leading-tight text-foreground">Indian VDA review</h2>
        </div>
        <div className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">cross-model audit</div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Approved</div>
          <div className="mt-1 font-mono text-base uppercase text-[var(--neon-cyan)]">{taxOpt.approved_decision ?? "—"}</div>
        </div>
        {typeof taxOpt.tax_impact?.after_tax_apy_delta_pct === "number" && (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">After-tax delta</div>
            <div className="mt-1 font-mono text-base text-foreground">
              {taxOpt.tax_impact.after_tax_apy_delta_pct.toFixed(2)}%
            </div>
          </div>
        )}
      </div>

      {taxOpt.rationale && <p className="text-base text-foreground">{taxOpt.rationale}</p>}

      {taxOpt.tax_impact && (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Estimated tax cost</div>
          <ul className="mt-2 space-y-1 font-mono text-xs text-foreground">
            <li>capital gains: ${Number(taxOpt.tax_impact.capital_gains_tax_usd ?? 0).toFixed(2)}</li>
            <li>TDS: ${Number(taxOpt.tax_impact.tds_usd ?? 0).toFixed(2)}</li>
            <li>total: ${Number(taxOpt.tax_impact.total_tax_cost_usd ?? 0).toFixed(2)}</li>
          </ul>
        </div>
      )}

      {taxOpt.modifications && (
        <p className="text-sm text-muted-foreground">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em]">Modifications:</span> {taxOpt.modifications}
        </p>
      )}

      {taxOpt.india_specific_flags && Object.values(taxOpt.india_specific_flags).some(Boolean) && (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {taxOpt.india_specific_flags.no_loss_offset_warning && <li>· No loss offset (Section 115BBH): losses cannot reduce other VDA gains</li>}
          {taxOpt.india_specific_flags.high_frequency_tds_drag && <li>· High-frequency TDS drag eroding returns</li>}
          {taxOpt.india_specific_flags.cost_basis_uncertainty && <li>· Cost basis not tracked yet — estimate is upper bound</li>}
        </ul>
      )}
    </section>
  );
}
