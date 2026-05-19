import {
  getCycleById,
  getPortfolioById,
  updateCycleStatus,
} from "@/app/services/portfolio.service";
import { runCritic } from "@/app/services/agents/critic.agent";
import { runTaxOptimizer } from "@/app/services/agents/tax-optimizer.agent";
import { runSwarm } from "@/app/services/swarm/swarm-runner.service";
import { aggregate, type AggregatorAction } from "@/app/services/swarm/aggregator.service";
import {
  fetchAllMids,
  fetchMetaAndCtxs,
  fetchClearinghouse,
} from "@/lib/data-sources/hyperliquid";
import { searchNews } from "@/lib/data-sources/news";
import { db } from "@/lib/db/client";
import { selboInstances, trades, monitorTicks } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { getRecentLessons } from "@/app/services/memory.service";
import {
  openPaperTrade,
  closePaperTrade,
} from "@/app/services/trades/paper-trade.service";
import { evaluatePerpRisk, riskNumber } from "@/app/services/risk-engine.service";
import { buildMarketFeatureSnapshot, type MarketFeatureSnapshot } from "@/lib/market-features";
import { detectStrategyMode } from "@/lib/strategy-mode";

function previousMarketFeatures(row: { context: unknown } | undefined): MarketFeatureSnapshot | null {
  const context = row?.context as { marketFeatures?: MarketFeatureSnapshot } | null | undefined;
  return context?.marketFeatures ?? null;
}

/**
 * Runs the deliberation chain for a single cycle: swarm -> aggregator ->
 * tax-optimizer -> critic -> trade execution. The cycle row is created
 * upstream in 'running' status; this function updates it to approved /
 * rejected / failed when done.
 *
 * On a critic-approved actionable verdict (open_long / open_short / close)
 * the panel-execution path opens or closes a paper trade through the same
 * helpers Fast Trader uses, so panel-driven trades show up in trade
 * history with on-chain anchors just like fast-trader-driven ones.
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
      .from(selboInstances)
      .where(eq(selboInstances.circleWalletAddress, portfolio.walletAddress))
      .limit(1);
    if (!instance) {
      throw new Error(
        `No selbo instance found for wallet ${portfolio.walletAddress}`,
      );
    }

    const watching = instance.currentlyWatching ?? ["ETH", "BTC", "SOL"];
    const strategyMode = detectStrategyMode(instance.strategyText);

    const [mids, meta, clearing, paperOpen, lastTick, newsRes, recentLessons] = await Promise.all([
      fetchAllMids().catch(() => ({} as Awaited<ReturnType<typeof fetchAllMids>>)),
      fetchMetaAndCtxs().catch(() => ({ universe: [], ctxs: [] })),
      fetchClearinghouse(instance.circleWalletAddress).catch(() => null),
      db.select().from(trades).where(
        and(eq(trades.userId, instance.userId), eq(trades.status, "open")),
      ),
      db.select().from(monitorTicks)
        .where(eq(monitorTicks.selboInstanceId, instance.id))
        .orderBy(desc(monitorTicks.createdAt))
        .limit(1)
        .then((r) => r[0]),
      searchNews(
        `${watching.join(" OR ")} OR perp futures OR funding rate OR crypto market`,
      ).catch(() => ({ results: [] as Array<{ title: string; source: string; publishedAt: string }> })),
      getRecentLessons(instance.userId, 8).catch(() => [] as string[]),
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
    const marketFeatures = await buildMarketFeatureSnapshot({
      watching,
      mids,
      universe: meta.universe,
      ctxs: meta.ctxs,
      strategyMode,
      previousSnapshot: previousMarketFeatures(lastTick),
    }).catch((err) => {
      console.error("[orchestrator] market feature build failed:", err);
      return {
        source: "hyperliquid-testnet" as const,
        generatedAt: new Date().toISOString(),
        symbols: [],
        skippedSymbols: watching.map((symbol) => ({
          symbol: symbol.toUpperCase(),
          reason: "feature build failed",
        })),
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

    const risk = evaluatePerpRisk({
      account: clearing
        ? {
            equityUsd: riskNumber(clearing.marginSummary.accountValue),
            withdrawableUsd: riskNumber(clearing.withdrawable),
          }
        : {
            equityUsd: Number(instance.simulatedBalanceUsd),
            withdrawableUsd: Number(instance.simulatedBalanceUsd),
          },
      positions: [
        ...hlPositions.map((p) => ({
          source: "hyperliquid" as const,
          asset: p.coin.toUpperCase(),
          side: riskNumber(p.size) === null ? "unknown" as const : riskNumber(p.size)! >= 0 ? "long" as const : "short" as const,
          sizeUsd: null,
          entryPrice: riskNumber(p.entry),
          markPrice: riskNumber(mids[p.coin.toUpperCase()]),
          leverage: typeof p.leverage === "object" ? p.leverage.value : null,
          liquidationPrice: riskNumber(p.liquidation),
          marginUsedUsd: riskNumber(p.margin_used),
          unrealizedPnlUsd: riskNumber(p.unrealized_pnl),
        })),
        ...paperOpen.map((t) => {
          const asset = t.asset.toUpperCase();
          return {
            source: "paper" as const,
            asset,
            side: t.side === "short" ? "short" as const : "long" as const,
            sizeUsd: Number(t.amountUsd),
            entryPrice: t.entryPrice ? Number(t.entryPrice) : null,
            markPrice: mids[asset] ? Number(mids[asset]) : null,
          };
        }),
      ],
    });

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
      marketFeatures,
      risk,
      recent_news: (newsRes.results ?? []).slice(0, 6).map((n) => ({
        title: n.title,
        source: n.source,
        hoursAgo: n.publishedAt
          ? Math.floor((Date.now() - new Date(n.publishedAt).getTime()) / 3_600_000)
          : null,
      })),
      recent_lessons: recentLessons,
    };

    const swarmDecisions = await runSwarm({ cycleId, context, size: 10 });
    if (swarmDecisions.length === 0) {
      throw new Error("Swarm produced no usable decisions");
    }
    const aggregated = await aggregate({ cycleId, decisions: swarmDecisions });

    const taxOpt = await runTaxOptimizer({
      cycleId,
      aggregated,
      positions: paperPositions,
    });
    // Reconcile tax-optimizer's action with the aggregator. "postpone" maps
    // to "stay" so the orchestrator's downstream branch logic stays simple.
    const taxAdjustedAction: AggregatorAction =
      taxOpt.approved_action === "postpone" ? "stay" : taxOpt.approved_action;
    const taxAdjusted =
      taxAdjustedAction === aggregated.action
        ? aggregated
        : {
            ...aggregated,
            action: taxAdjustedAction,
            rationale: `${aggregated.rationale} | Tax-adjusted: ${taxOpt.rationale}`,
          };

    const verdict = await runCritic({
      cycleId,
      decision: taxAdjusted,
      positions: paperPositions,
      goal: instance.strategyText,
    });

    const finalStatus: "approved" | "rejected" =
      verdict.verdict === "reject" ? "rejected" : "approved";

    // On approved actionable verdict, fire the corresponding paper-trade
    // helper. Failures here are logged + propagated through cycleState so
    // the trace page surfaces them, but they do not crash the cycle.
    let executed: { tradeId?: string; pnlUsd?: number | null; error?: string } | null = null;
    if (finalStatus === "approved" && taxAdjusted.action !== "stay") {
      try {
        if (taxAdjusted.action === "open_long" || taxAdjusted.action === "open_short") {
          if (!taxAdjusted.if_open) throw new Error("aggregator returned open without if_open");
          const asset = taxAdjusted.if_open.asset.toUpperCase();
          const markPx = mids[asset] ? Number(mids[asset]) : null;
          const side = taxAdjusted.action === "open_long" ? "long" : "short";
          // Translate the aggregator's percent triggers into absolute price
          // levels for the safety enforcer.
          let stopLossPriceUsd: number | null = null;
          let takeProfitPriceUsd: number | null = null;
          if (markPx !== null) {
            if (taxAdjusted.if_open.stopLossPct !== null) {
              const m = side === "long"
                ? 1 - taxAdjusted.if_open.stopLossPct / 100
                : 1 + taxAdjusted.if_open.stopLossPct / 100;
              stopLossPriceUsd = markPx * m;
            }
            if (taxAdjusted.if_open.takeProfitPct !== null) {
              const m = side === "long"
                ? 1 + taxAdjusted.if_open.takeProfitPct / 100
                : 1 - taxAdjusted.if_open.takeProfitPct / 100;
              takeProfitPriceUsd = markPx * m;
            }
          }
          const opened = await openPaperTrade({
            userId: instance.userId,
            walletId: instance.circleWalletId,
            asset,
            side,
            sizeUsd: taxAdjusted.if_open.sizeUsd,
            entryPriceUsd: markPx,
            stopLossPriceUsd,
            takeProfitPriceUsd,
            source: "panel",
            rationale: taxAdjusted.rationale,
            agentContext: {
              cycleId,
              aggregated,
              taxAdjusted,
              swarmDecisionsCount: swarmDecisions.length,
            } as import("@/lib/arc/anchor").AnchorJsonValue,
          });
          executed = { tradeId: opened.tradeId };
        } else if (taxAdjusted.action === "close") {
          if (!taxAdjusted.if_close) throw new Error("aggregator returned close without if_close");
          const asset = taxAdjusted.if_close.asset.toUpperCase();
          const markPx = mids[asset] ? Number(mids[asset]) : null;
          const result = await closePaperTrade({
            userId: instance.userId,
            walletId: instance.circleWalletId,
            selboInstanceId: instance.id,
            asset,
            markPriceUsd: markPx,
            source: "panel",
            rationale: taxAdjusted.rationale,
          });
          executed = result ?? { error: "no matching open position to close" };
        }
      } catch (err) {
        executed = { error: err instanceof Error ? err.message : String(err) };
        console.error(`[orchestrator] panel-execution failed for cycle ${cycleId}:`, err);
      }
    }

    await updateCycleStatus(cycleId, finalStatus, {
      cycleState: {
        context,
        swarm: swarmDecisions,
        aggregated,
        taxOptimizer: taxOpt,
        taxAdjusted,
        verdict,
        executed,
        anchoredOnChain: false,
      },
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
