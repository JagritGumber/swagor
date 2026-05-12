import {
  getCycleById,
  getPortfolioById,
  updateCycleStatus,
} from "@/app/services/portfolio.service";
import { runDecider } from "@/app/services/agents/decider.agent";
import { runCritic } from "@/app/services/agents/critic.agent";
import { getArcUsdcBalance } from "@/lib/protocols/arc-usdc";
import { fetchPrices } from "@/lib/data-sources/coingecko";
import { fetchYieldPools } from "@/lib/data-sources/defillama";
import { searchNews } from "@/lib/data-sources/news";

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

    const decision = await runDecider({ cycleId, context });
    const verdict = await runCritic({
      cycleId,
      decision,
      positions,
      goal: portfolio.goalParsed,
    });

    const finalStatus: "approved" | "rejected" =
      verdict.verdict === "reject" ? "rejected" : "approved";

    await updateCycleStatus(cycleId, finalStatus, {
      cycleState: { context, decision, verdict },
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
