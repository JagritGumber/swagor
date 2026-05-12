import {
  getCycleById,
  getPortfolioById,
  updateCycleStatus,
} from "@/app/services/portfolio.service";
import { runCritic } from "@/app/services/agents/critic.agent";
import { runTaxOptimizer } from "@/app/services/agents/tax-optimizer.agent";
import { runSwarm } from "@/app/services/swarm/swarm-runner.service";
import { aggregate } from "@/app/services/swarm/aggregator.service";
import { getArcUsdcBalance } from "@/lib/protocols/arc-usdc";
import { fetchPrices } from "@/lib/data-sources/coingecko";
import { fetchYieldPools } from "@/lib/data-sources/defillama";
import { searchNews } from "@/lib/data-sources/news";
import { anchorCycle } from "@/lib/arc/anchor";

/**
 * Runs the agent chain for a single cycle. Fire-and-forget from the API route:
 * the cycle row is created immediately in 'running' status, then this function
 * does the work in the background, updating the row to 'approved' / 'rejected'
 * / 'failed' when done.
 *
 * Chain (hackathon minimum): Decider -> Critic. Future: add Graph Builder,
 * RegimeAnalyzer, swarm, etc. as separate calls before Decider.
 */
export async function runCycle(cycleId: string): Promise<void> {
  try {
    const cycle = await getCycleById(cycleId);
    if (!cycle?.portfolioId) {
      throw new Error("Cycle has no portfolio");
    }
    const portfolio = await getPortfolioById(cycle.portfolioId);
    if (!portfolio?.walletAddress) {
      throw new Error("Portfolio has no connected wallet");
    }

    // Gather context in parallel; tolerate individual failures.
    const [positions, prices, yields, news] = await Promise.all([
      getArcUsdcBalance(portfolio.walletAddress as `0x${string}`),
      fetchPrices(["bitcoin", "ethereum", "usd-coin"]).catch(() => null),
      fetchYieldPools().catch(() => []),
      searchNews("USDC depeg OR Aave OR Compound OR Pendle yield OR stablecoin").catch(() => ({ results: [] })),
    ]);

    const context = {
      positions,
      goal: portfolio.goalParsed ?? null,
      market: {
        prices,
        top_yields: yields.slice(0, 8),
        recent_news: news.results?.slice(0, 6) ?? [],
      },
    };

    // Swarm: 25 persona-bearing agents run in parallel
    const swarmDecisions = await runSwarm({ cycleId, context, size: 25 });
    if (swarmDecisions.length === 0) {
      throw new Error("Swarm produced no usable decisions");
    }
    const aggregated = await aggregate({ cycleId, decisions: swarmDecisions });

    // TaxOptimizer (cross-model) reviews through Indian VDA tax lens
    const taxOpt = await runTaxOptimizer({ cycleId, aggregated, positions });
    const taxAdjusted =
      taxOpt.approved_decision === aggregated.decision
        ? aggregated
        : {
            ...aggregated,
            decision: (taxOpt.approved_decision === "postpone"
              ? "stay"
              : taxOpt.approved_decision) as typeof aggregated.decision,
            rationale: `${aggregated.rationale} | Tax-adjusted: ${taxOpt.rationale}`,
          };

    // Critic (cross-model) reviews the tax-adjusted decision
    const verdict = await runCritic({
      cycleId,
      decision: taxAdjusted as object as Parameters<typeof runCritic>[0]["decision"],
      positions,
      goal: portfolio.goalParsed,
    });

    const finalStatus: "approved" | "rejected" =
      verdict.verdict === "reject" ? "rejected" : "approved";

    // Fire the Arc anchor non-blocking. If the contract isn't deployed
    // yet this returns null and we log a warning, but the cycle still
    // completes cleanly.
    let arcAnchor = null;
    try {
      arcAnchor = await anchorCycle({
        cycleId,
        cycleState: { context, swarm: swarmDecisions, aggregated, taxOptimizer: taxOpt, taxAdjusted, verdict },
        verdict: finalStatus,
      });
    } catch (err) {
      console.error("[orchestrator] anchorCycle threw:", err);
    }

    await updateCycleStatus(cycleId, finalStatus, {
      cycleState: { context, swarm: swarmDecisions, aggregated, taxOptimizer: taxOpt, taxAdjusted, verdict, arcAnchor },
      arcTxHash: arcAnchor?.txId,
      completedAt: new Date(),
    });
  } catch (err) {
    console.error(`Cycle ${cycleId} failed:`, err);
    await updateCycleStatus(cycleId, "failed", {
      cycleState: {
        error: err instanceof Error ? err.message : String(err),
      },
      completedAt: new Date(),
    }).catch(() => {
      /* swallow secondary failure */
    });
  }
}
