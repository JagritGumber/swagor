import {
  getCycleById,
  getPortfolioById,
  updateCycleStatus,
} from "@/app/services/portfolio.service";
import { runCritic } from "@/app/services/agents/critic.agent";
import { runTaxOptimizer } from "@/app/services/agents/tax-optimizer.agent";
import { runSwarm } from "@/app/services/swarm/swarm-runner.service";
import { aggregate } from "@/app/services/swarm/aggregator.service";
import {
  fetchAllMids,
  fetchMetaAndCtxs,
  fetchClearinghouse,
} from "@/lib/data-sources/hyperliquid";
import { searchNews } from "@/lib/data-sources/news";
import { anchorCycle } from "@/lib/arc/anchor";
import { db } from "@/lib/db/client";
import { solonInstances, trades, monitorTicks } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";

/**
 * Runs the agent chain for a single cycle. Fire-and-forget from the API route:
 * the cycle row is created immediately in 'running' status, then this function
 * does the work in the background, updating the row to 'approved' / 'rejected'
 * / 'failed' when done.
 *
 * Context fetched is perp-specific (Hyperliquid mids/funding, user paper
 * positions, watcher rationale) so the swarm reasons about what Selbo
 * actually trades, not yield-routing artifacts.
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

    const [instance] = await db
      .select()
      .from(solonInstances)
      .where(eq(solonInstances.circleWalletAddress, portfolio.walletAddress))
      .limit(1);
    if (!instance) {
      throw new Error(
        `No solon instance found for wallet ${portfolio.walletAddress}`,
      );
    }

    const watching = instance.currentlyWatching ?? ["ETH", "BTC", "SOL"];

    const [mids, meta, clearing, paperOpen, lastTick, newsRes] = await Promise.all([
      fetchAllMids().catch(() => ({} as Awaited<ReturnType<typeof fetchAllMids>>)),
      fetchMetaAndCtxs().catch(() => ({ universe: [], ctxs: [] })),
      fetchClearinghouse(instance.circleWalletAddress).catch(() => null),
      db.select().from(trades).where(
        and(eq(trades.userId, instance.userId), eq(trades.status, "open")),
      ),
      db.select().from(monitorTicks)
        .where(eq(monitorTicks.solonInstanceId, instance.id))
        .orderBy(desc(monitorTicks.createdAt))
        .limit(1)
        .then((r) => r[0]),
      searchNews(
        `${watching.join(" OR ")} OR perp futures OR funding rate OR crypto market`,
      ).catch(() => ({ results: [] as Array<{ title: string; source: string; publishedAt: string }> })),
    ]);

    const ctxByCoin = new Map(meta.universe.map((u, i) => [u.name.toUpperCase(), meta.ctxs[i]]));
    const perps = watching.map((sym) => {
      const upper = sym.toUpperCase();
      const ctx = ctxByCoin.get(upper);
      return {
        symbol: upper,
        mid: mids[upper] ?? null,
        mark: ctx?.markPx ?? null,
        funding_hourly: ctx?.funding ?? null,
        open_interest: ctx?.openInterest ?? null,
        prev_day_px: ctx?.prevDayPx ?? null,
      };
    });

    const hlPositions = clearing?.assetPositions.map((p) => ({
      coin: p.position.coin,
      size: p.position.szi,
      entry: p.position.entryPx,
      leverage: p.position.leverage,
      liquidation: p.position.liquidationPx,
      unrealized_pnl: p.position.unrealizedPnl,
      margin_used: p.position.marginUsed,
    })) ?? [];

    const paperPositions = paperOpen.map((t) => ({
      asset: t.asset,
      side: t.side,
      size_usd: Number(t.amountUsd),
      entry: t.entryPrice ? Number(t.entryPrice) : null,
      opened_at: t.openedAt,
    }));

    const context = {
      strategy: instance.strategyText,
      watcher_rationale: lastTick?.rationale ?? null,
      watching,
      account: clearing
        ? {
            equity: clearing.marginSummary.accountValue,
            withdrawable: clearing.withdrawable,
          }
        : { equity: Number(instance.simulatedBalanceUsd), withdrawable: Number(instance.simulatedBalanceUsd) },
      paper_positions: paperPositions,
      hl_positions: hlPositions,
      perps,
      recent_news: (newsRes.results ?? []).slice(0, 6).map((n) => ({
        title: n.title,
        source: n.source,
        hoursAgo: n.publishedAt
          ? Math.floor((Date.now() - new Date(n.publishedAt).getTime()) / 3_600_000)
          : null,
      })),
    };

    // Swarm size capped to 10 to stay under per-key GLM concurrency limits.
    // Bumping past 10 reliably hits 1302 rate limit errors on the paid tier.
    const swarmDecisions = await runSwarm({ cycleId, context, size: 10 });
    if (swarmDecisions.length === 0) {
      throw new Error("Swarm produced no usable decisions");
    }
    const aggregated = await aggregate({ cycleId, decisions: swarmDecisions });

    // TaxOptimizer (cross-model) reviews through Indian VDA tax lens.
    const taxOpt = await runTaxOptimizer({
      cycleId,
      aggregated,
      positions: paperPositions,
    });
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

    const verdict = await runCritic({
      cycleId,
      decision: taxAdjusted as object as Parameters<typeof runCritic>[0]["decision"],
      positions: paperPositions,
      goal: instance.strategyText,
    });

    const finalStatus: "approved" | "rejected" =
      verdict.verdict === "reject" ? "rejected" : "approved";

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
