import "server-only";

import { db } from "@/lib/db/client";
import { trades } from "@/lib/db/schema";
import { traderLlm, MODELS } from "@/lib/llm-client";
import { fetchAllMids, fetchMetaAndCtxs, fetchClearinghouse } from "@/lib/data-sources/hyperliquid";
import type { SolonInstance } from "@/lib/db/schema/solon-instances";
import { FAST_TRADER_SCHEMA, FAST_TRADER_SYSTEM_PROMPT, type FastTraderDecision } from "./prompt";

/**
 * Run the Fast Trader for a Solon instance. Reads fresh Hyperliquid state
 * (fresher than the watcher payload — sub-second decisions need it), calls
 * the trader-tier LLM, and on a non-hold decision writes a paper-mode
 * `trades` row at the current mark price.
 *
 * Real-mode order placement on Hyperliquid (signed via Circle wallet)
 * lands in a follow-up commit; paper mode is the demo-safe path.
 */
export async function runFastTraderForInstance(
  instance: SolonInstance,
  watcherRationale: string,
): Promise<FastTraderDecision> {
  const [mids, meta, clearing] = await Promise.all([
    fetchAllMids().catch(() => ({} as Awaited<ReturnType<typeof fetchAllMids>>)),
    fetchMetaAndCtxs().catch(() => ({ universe: [], ctxs: [] })),
    fetchClearinghouse(instance.circleWalletAddress).catch(() => null),
  ]);

  const watching = instance.currentlyWatching ?? ["ETH", "BTC", "SOL"];
  const ctxByCoin = new Map(meta.universe.map((u, i) => [u.name.toUpperCase(), meta.ctxs[i]]));
  const perps = watching.map((sym) => {
    const upper = sym.toUpperCase();
    const ctx = ctxByCoin.get(upper);
    return {
      symbol: upper,
      mark: ctx?.markPx ?? mids[upper] ?? null,
      funding_hourly: ctx?.funding ?? null,
      open_interest: ctx?.openInterest ?? null,
    };
  });

  const positions = clearing?.assetPositions.map((p) => ({
    coin: p.position.coin,
    size: p.position.szi,
    entry: p.position.entryPx,
    leverage: p.position.leverage,
    liquidation: p.position.liquidationPx,
    unrealized_pnl: p.position.unrealizedPnl,
  })) ?? [];

  const payload = JSON.stringify({
    strategy: instance.strategyText,
    watcher_rationale: watcherRationale,
    account: clearing
      ? { equity: clearing.marginSummary.accountValue, withdrawable: clearing.withdrawable }
      : { equity: instance.simulatedBalanceUsd, withdrawable: instance.simulatedBalanceUsd },
    positions,
    perps,
  });

  const completion = await traderLlm.chat.completions.create({
    model: MODELS.TRADER,
    messages: [
      { role: "system", content: FAST_TRADER_SYSTEM_PROMPT },
      { role: "user", content: payload },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("fast-trader returned empty response");
  const decision = FAST_TRADER_SCHEMA.parse(JSON.parse(raw));

  if (decision.action !== "hold") {
    const markPx = mids[decision.asset.toUpperCase()] ? Number(mids[decision.asset.toUpperCase()]) : null;
    await db.insert(trades).values({
      userId: instance.userId,
      asset: decision.asset.toUpperCase(),
      venue: "hyperliquid",
      side: decision.action === "open_long" ? "long" : "short",
      amountUsd: decision.size_usd.toString(),
      entryPrice: markPx ? markPx.toString() : null,
      status: "open",
      mode: "simulation",
      openedAt: new Date(),
    });
    console.log(
      `[fast-trader] ${decision.action} ${decision.asset} $${decision.size_usd} ${decision.leverage}x at ${markPx}`,
    );
  } else {
    console.log(`[fast-trader] hold for ${instance.id}: ${decision.rationale}`);
  }

  return decision;
}
