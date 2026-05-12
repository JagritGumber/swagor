/**
 * Solon v4 module contracts — single source of truth for parallel worktrees.
 *
 * Every §3.X module in C:\Users\jagri\.claude\plans\solon-public-ai-trader.md
 * exports an Input schema, an Output schema, and at least one mock Fixture.
 * Agents implementing each module read this file, build to match, and
 * validate their function's output with `<Module>OutputSchema.parse(result)`
 * before claiming completion.
 *
 * File-size note: this is a contracts/types file, not executable logic.
 * Length is acceptable because it consolidates ~10 module specs.
 */

import { z } from "zod";

// ============================================================================
// SHARED PRIMITIVES
// ============================================================================

export const UUID = z.string().uuid();
export const Decimal = z.string().regex(/^-?\d+(\.\d+)?$/); // numeric stored as string
export const ISO = z.string().datetime({ offset: true });

export const PositionSnapshot = z.object({
  protocol: z.enum(["wallet", "aave", "compound", "pendle", "dsr", "usyc"]),
  chain: z.string(),
  asset: z.string(),
  amount: z.string(),
  amountWei: z.string(),
  decimals: z.number().int(),
});

export const MarketContext = z.object({
  prices: z.record(z.string(), z.number()).nullable(),
  topYields: z.array(z.object({
    project: z.string(),
    chain: z.string(),
    symbol: z.string(),
    apy: z.number().nullable(),
    tvlUsd: z.number(),
  })),
  recentNews: z.array(z.object({
    title: z.string(),
    url: z.string().url(),
    publishedAt: ISO.optional(),
  })),
});

export const UserStrategy = z.object({
  text: z.string(),
  parsed: z.object({
    riskTolerance: z.enum(["low", "moderate", "high"]),
    targetApyPct: z.number().nullable(),
    timeHorizonDays: z.number().int().nullable(),
    allowedVenues: z.array(z.string()),
    constraints: z.array(z.string()),
  }).nullable(),
});

// ============================================================================
// §3.0 User Provisioning Service                                  [BACKEND]
// ============================================================================

export const ProvisioningInputSchema = z.object({
  userId: UUID,
  email: z.string().email(),
});

export const ProvisioningOutputSchema = z.object({
  circleWalletId: z.string(),
  circleWalletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  faucetTxHash: z.string().nullable(),
  defaultStrategy: z.string(),
  simulatedBalanceUsd: z.string(),
});

export const ProvisioningFixture = {
  input: {
    userId: "a8e2f1c4-3d5b-4e7a-9f1c-2d4b6e8a0c3f",
    email: "alice@example.com",
  },
  expectedOutputShape: {
    circleWalletId: "wallet_abc123",
    circleWalletAddress: "0x963a2f654785D3Fee8baE1BE1b41268C32dcC89f",
    faucetTxHash: null,
    defaultStrategy: "Moderate risk. USDC stablecoin yield focus. Target 5-15% conviction trades. No leverage.",
    simulatedBalanceUsd: "1000",
  },
};

// ============================================================================
// §3.1 Monitor Service                                            [BACKEND]
// ============================================================================

export const MonitorContextSchema = z.object({
  userId: UUID,
  positions: z.array(PositionSnapshot),
  recentPrices: z.record(z.string(), z.number()),
  recentNews: z.array(z.object({ title: z.string(), summary: z.string() })),
  lastLessons: z.array(z.string()),
  ticksWithoutSignal: z.number().int().nonnegative(),
  userStrategy: UserStrategy,
});

export const MonitorTickSchema = z.object({
  id: UUID,
  userId: UUID,
  hasSignal: z.boolean(),
  signalType: z.enum(["momentum", "depeg_risk", "yield_window", "news_driven", "idle_park"]).nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  reasoning: z.string(),
  observedAt: ISO,
});

export const MonitorFixtures = {
  noSignal: {
    input: { ticksWithoutSignal: 3, recentNews: [], recentPrices: { USDC: 1.0 } },
    expectedHasSignal: false,
  },
  depegRisk: {
    input: {
      ticksWithoutSignal: 0,
      recentPrices: { USDe: 0.992, USDC: 1.0 },
      recentNews: [{ title: "USDe depeg fears as Ethena reserves shift", summary: "..." }],
    },
    expectedHasSignal: true,
    expectedSignalType: "depeg_risk",
  },
};

// ============================================================================
// §3.2 Solon Agent (Proposal)                                     [BACKEND]
// ============================================================================

export const SolonInputSchema = z.object({
  signal: MonitorTickSchema,
  positions: z.array(PositionSnapshot),
  market: MarketContext,
  memory: z.object({
    lastTrades: z.array(z.object({
      asset: z.string(),
      side: z.string(),
      pnlPct: z.number().nullable(),
      closedAt: ISO.nullable(),
    })),
    lessons: z.array(z.string()),
  }),
  userStrategy: UserStrategy,
});

export const TradeProposalSchema = z.object({
  id: UUID,
  userId: UUID,
  asset: z.string(),
  side: z.enum(["buy", "sell", "rotate_into", "rotate_out", "park_usyc"]),
  sizeUsd: Decimal,
  venue: z.string(),
  expectedPnlPct: z.number().nullable(),
  reasoningTrace: z.string().min(40), // no boilerplate; min length forces specifics
  safetyTriggers: z.object({
    stopLossPx: z.number(),
    takeProfitPx: z.number(),
    timeBudget: z.string(),
  }),
});

// ============================================================================
// §3.3 Trade Review Council                                       [BACKEND]
// ============================================================================

export const ReviewerVerdictSchema = z.object({
  reviewer: z.enum(["hermes", "athena", "cassandra"]),
  verdict: z.enum(["approve", "approve_with_concern", "reject"]),
  concern: z.string(),
  confidence: z.number().min(0).max(1),
});

export const CouncilVerdictsSchema = z.object({
  round: z.union([z.literal(1), z.literal(2)]),
  hermes: ReviewerVerdictSchema,
  athena: ReviewerVerdictSchema,
  cassandra: ReviewerVerdictSchema,
});

export const CouncilFixtures = {
  tvlFragile: {
    proposal: { asset: "PT-eUSDe", side: "rotate_into", venue: "pendle-eth", sizeUsd: "600" },
    expectedRound1Cassandra: "reject", // TVL drift in news → Cassandra dissents
  },
};

// ============================================================================
// §3.4 Synthesis Writer                                           [BACKEND]
// ============================================================================

export const SynthesisOutputSchema = z.object({
  paragraph: z.string().min(80),
  verdictCounts: z.object({
    approve: z.number().int().min(0).max(3),
    approve_with_concern: z.number().int().min(0).max(3),
    reject: z.number().int().min(0).max(3),
  }),
  dominantVerdict: z.string(),
  dispersion: z.number().min(0).max(1),
  dissentingReviewers: z.array(z.string()),
});

// ============================================================================
// §3.5 Critic                                                     [BACKEND]
// ============================================================================

export const CriticVerdictSchema = z.object({
  verdict: z.enum(["approve", "modify", "reject"]),
  concerns: z.array(z.string()).max(3),
  suggestedModification: z.string().nullable(),
  metadata: z.object({
    fallbackToGlmHeavy: z.boolean().optional(),
  }).optional(),
});

// ============================================================================
// §3.6 Executor (simulation mode v1)                              [EXECUTOR]
// ============================================================================

export const ExecutionResultSchema = z.object({
  tradeId: UUID,
  userId: UUID,
  simulatedTxHash: z.string(),
  executedPrice: Decimal,
  executedAmount: Decimal,
  gasFeeUsd: Decimal.nullable(),
  slippagePct: z.number().nullable(),
  status: z.enum(["executed", "failed"]),
  failureReason: z.string().nullable(),
  settledOn: z.enum(["simulation", "arc", "ethereum", "base", "arbitrum"]),
});

export const ExecutorFixtures = {
  usdeUsdcSpot: {
    proposal: { asset: "USDe/USDC", side: "rotate_into", venue: "uniswap-v3-eth", sizeUsd: "500" },
    expectedFields: { status: "executed", settledOn: "simulation" },
    pricingNote: "Entry price must match contemporaneous Uniswap V3 USDe/USDC pool spot (subgraph or slot0()) within 0.1%. CoinGecko is fallback only.",
  },
};

// ============================================================================
// §3.7 Position Monitor                                           [BACKEND]
// ============================================================================

export const PositionUpdateSchema = z.object({
  tradeId: UUID,
  newStatus: z.enum(["open", "closed", "failed"]).optional(),
  exitPrice: Decimal.optional(),
  exitTimestamp: ISO.optional(),
  pnlUsd: Decimal.optional(),
  triggeredBy: z.enum(["stop_loss", "take_profit", "time_budget", "solon_close", "none"]).optional(),
});

// ============================================================================
// §3.8 Anchor Service                                             [EXECUTOR]
// ============================================================================

export const AnchorPayloadSchema = z.object({
  tradeId: UUID,
  userId: UUID,
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  reasoningHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  synthesisHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  verdict: z.string(),
});

export const AnchorResultSchema = z.object({
  arcTxId: z.string(),
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

// ============================================================================
// §3.9 Memory Service                                             [BACKEND]
// ============================================================================

export const ReviewerAccuracySchema = z.object({
  verdict: z.enum(["correct", "wrong", "unclear"]),
  justification: z.string(),
});

export const MemoryUpdateSchema = z.object({
  memoryEntry: z.object({
    userId: UUID,
    tradeId: UUID,
    outcome: z.enum(["win", "loss", "breakeven"]),
    pnlPct: z.number().nullable(),
    reviewerAccuracy: z.object({
      hermes: ReviewerAccuracySchema,
      athena: ReviewerAccuracySchema,
      cassandra: ReviewerAccuracySchema,
    }),
    lessons: z.array(z.string()).max(3),
  }),
  trackRecordUpdates: z.array(z.object({
    userId: UUID,
    reviewerId: z.enum(["hermes", "athena", "cassandra"]),
    tradesEvaluated: z.number().int(),
    correctCalls: z.number().int(),
  })),
});

// ============================================================================
// §3.12 Auto-Tweet Hook                                           [BACKEND]
// ============================================================================

export const TweetDraftSchema = z.object({
  userId: UUID,
  tradeId: UUID,
  content: z.string().max(280),
  posted: z.boolean(),
});

export const TweetTrigger = {
  significantPnL: { pnlPctAbs: 5 },
  firstTradeOfDay: true,
} as const;

// ============================================================================
// VALIDATION HELPER — agents call this after their function runs
// ============================================================================

export function validateOutput<T>(
  schema: z.ZodSchema<T>,
  output: unknown,
  moduleName: string,
): T {
  const result = schema.safeParse(output);
  if (!result.success) {
    throw new Error(
      `[contract] ${moduleName} output failed schema check: ${result.error.message}`,
    );
  }
  return result.data;
}
