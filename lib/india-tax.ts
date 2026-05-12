/**
 * Indian Virtual Digital Asset (VDA) tax constants — FY 2026.
 * Pure data. Decision logic lives in the TaxOptimizer agent which consumes
 * these constants in its prompt context.
 *
 * Sources: Section 115BBH (capital gains), Section 194S (TDS) of the Indian
 * Income Tax Act. Confirm with a tax advisor before any live-money use.
 */
export const INDIAN_VDA_TAX = {
  /** 30% flat tax on gains from VDA transfers. No bracket relief. */
  capitalGainsRate: 0.30,

  /** Education + health cess on the tax (4% surcharge on the tax amount). */
  cessRate: 0.04,

  /** 1% TDS on every VDA transfer (Section 194S). */
  tdsRate: 0.01,

  /** TDS threshold per FY for specified persons (Rs.50,000). */
  tdsAnnualThresholdInr: 50_000,

  /** Losses from one VDA cannot offset gains from another. */
  allowInterAssetOffset: false,

  /** VDA losses cannot be carried forward to future years. */
  allowLossCarryForward: false,

  /** No deductions allowed except cost of acquisition. */
  allowExpenseDeduction: false,
} as const;

export type VDAtaxConfig = typeof INDIAN_VDA_TAX;

/**
 * Short prose summary suitable for injection into an LLM prompt context.
 */
export const INDIAN_VDA_TAX_PROMPT_BRIEF = `
Indian Virtual Digital Asset (VDA) tax rules (FY 2026):
- 30% flat tax on capital gains from VDA transfers (Section 115BBH), plus 4% cess.
- 1% TDS withheld on every disposal above Rs.50,000/year per counter-party (Section 194S).
- Losses from one VDA CANNOT offset gains from another (no inter-asset offset).
- Losses CANNOT be carried forward to future years.
- No expense deductions allowed except the original cost of acquisition.
Implication: every rebalance has a tax cost. Frequent churn is taxed brutally.
Holding a position is meaningfully cheaper than rotating it.
`.trim();
