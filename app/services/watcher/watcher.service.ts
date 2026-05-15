import "server-only";

import { db } from "@/lib/db/client";
import { monitorTicks, selboInstances, equitySnapshots, type SelboInstance } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { watcherLlm, MODELS } from "@/lib/llm-client";
import {
  fetchAllMids,
  fetchMetaAndCtxs,
  fetchClearinghouse,
} from "@/lib/data-sources/hyperliquid";
import { searchNews } from "@/lib/data-sources/news";
import { WATCHER_SCHEMA, WATCHER_SYSTEM_PROMPT, type WatcherOutput } from "./prompt";
import { triggerCycleFromWatcher } from "./trigger";
import { runFastTraderForInstance } from "@/app/services/fast-trader/fast-trader.service";
import { tierSpec, type Tier } from "@/lib/tiers";
import { evaluatePerpRisk, riskNumber } from "@/app/services/risk-engine.service";
import { anchorWatcherDecision, type AnchorJsonValue } from "@/lib/arc/anchor";
import { logLlmCall } from "@/lib/llm/log";
import { buildMarketFeatureSnapshot } from "@/lib/market-features";

/**
 * Run one watcher tick for a given Selbo instance. Reads Hyperliquid mark
 * prices, funding rates, and the user's open positions, plus recent news,
 * then asks the watcher to classify the tick. Persists the verdict,
 * advances next_watcher_at, and on `execute` or `deliberate` routes to the
 * appropriate downstream tier.
 */
export async function runWatcherForInstance(instanceId: string): Promise<WatcherOutput> {
  const [instance] = await db
    .select().from(selboInstances).where(eq(selboInstances.id, instanceId)).limit(1);
  if (!instance) throw new Error(`selbo_instances ${instanceId} not found`);
  if (instance.killSwitchActive) throw new Error("kill switch active, refusing to tick");

  const watching = instance.currentlyWatching ?? ["ETH", "BTC", "SOL"];

  const [mids, meta, clearing, newsRes, lastTick] = await Promise.all([
    fetchAllMids().catch(() => ({} as Awaited<ReturnType<typeof fetchAllMids>>)),
    fetchMetaAndCtxs().catch(() => ({ universe: [], ctxs: [] })),
    fetchClearinghouse(instance.circleWalletAddress).catch(() => null),
    searchNews(`${watching.join(" OR ")} OR perp OR crypto`)
      .catch(() => ({ results: [] as Array<{ title: string; source: string; publishedAt: string }> })),
    db.select().from(monitorTicks)
      .where(eq(monitorTicks.selboInstanceId, instance.id))
      .orderBy(desc(monitorTicks.createdAt)).limit(1).then((r) => r[0]),
  ]);

  // Build a per-coin perp snapshot the agent can read directly.
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
  }).catch((err) => {
    console.error("[watcher] market feature build failed:", err);
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

  const positions = clearing?.assetPositions.map((p) => ({
    coin: p.position.coin,
    size: p.position.szi,
    entry: p.position.entryPx,
    leverage: p.position.leverage,
    liquidation: p.position.liquidationPx,
    unrealized_pnl: p.position.unrealizedPnl,
    margin_used: p.position.marginUsed,
  })) ?? [];

  // Equity snapshot for the dashboard equity curve + balance delta. Audit
  // write; failure must not break the tick.
  try {
    await db.insert(equitySnapshots).values({
      userId: instance.userId,
      selboInstanceId: instance.id,
      equityUsd: String(clearing?.marginSummary.accountValue ?? instance.simulatedBalanceUsd),
      withdrawableUsd: String(clearing?.withdrawable ?? instance.simulatedBalanceUsd),
      openPositionsCount: positions.length,
    });
  } catch (err) {
    console.error("[watcher] equity snapshot insert failed:", err);
  }

  const risk = evaluatePerpRisk({
    account: {
      equityUsd: riskNumber(clearing?.marginSummary.accountValue),
      withdrawableUsd: riskNumber(clearing?.withdrawable),
    },
    positions: positions.map((p) => ({
      source: "hyperliquid",
      asset: p.coin.toUpperCase(),
      side: riskNumber(p.size) === null ? "unknown" : riskNumber(p.size)! >= 0 ? "long" : "short",
      sizeUsd: riskNumber(p.margin_used),
      entryPrice: riskNumber(p.entry),
      markPrice: riskNumber(mids[p.coin.toUpperCase()]),
      leverage: typeof p.leverage === "object" ? p.leverage.value : null,
      liquidationPrice: riskNumber(p.liquidation),
      marginUsedUsd: riskNumber(p.margin_used),
      unrealizedPnlUsd: riskNumber(p.unrealized_pnl),
    })),
  });

  const userPayload = JSON.stringify({
    strategy: instance.strategyText,
    watching,
    account: clearing
      ? { equity: clearing.marginSummary.accountValue, withdrawable: clearing.withdrawable }
      : null,
    positions,
    perps,
    marketFeatures,
    risk,
    news: (newsRes.results ?? []).slice(0, 6).map((n) => ({
      title: n.title, source: n.source,
      hoursAgo: n.publishedAt ? Math.floor((Date.now() - new Date(n.publishedAt).getTime()) / 3_600_000) : null,
    })),
    lastVerdict: lastTick?.verdict ?? null,
    minutesSinceLastTick: lastTick ? Math.floor((Date.now() - new Date(lastTick.createdAt).getTime()) / 60_000) : null,
  });

  let llmCallTrace:
    | {
        rawResponse: string;
        promptTokens: number | undefined;
        completionTokens: number | undefined;
      }
    | null = null;

  const parsed: WatcherOutput =
    risk.status === "critical"
      ? {
          verdict: "risk_emergency",
          rationale: risk.summary,
          nextCheckSeconds: 120,
          watching,
        }
      : await (async () => {
          const completion = await watcherLlm.chat.completions.create({
            model: MODELS.WATCHER,
            messages: [
              { role: "system", content: WATCHER_SYSTEM_PROMPT },
              { role: "user", content: userPayload },
            ],
            response_format: { type: "json_object" },
            temperature: 0.2,
          });

          const raw = completion.choices[0]?.message?.content;
          if (!raw) throw new Error("watcher returned empty response");
          llmCallTrace = {
            rawResponse: raw,
            promptTokens: completion.usage?.prompt_tokens,
            completionTokens: completion.usage?.completion_tokens,
          };
          return WATCHER_SCHEMA.parse(JSON.parse(raw));
        })();

  // Apply per-tier cadence floor: free users tick less often than basic+.
  const spec = tierSpec(instance.subscriptionTier as Tier);
  const clampedNext =
    parsed.verdict === "risk_emergency"
      ? Math.min(parsed.nextCheckSeconds, 120)
      : Math.min(
          Math.max(parsed.nextCheckSeconds, spec.watcherMinCadenceSeconds),
          spec.watcherMaxCadenceSeconds,
        );

  const [tickRow] = await db.insert(monitorTicks).values({
    selboInstanceId: instance.id,
    verdict: parsed.verdict,
    rationale: parsed.rationale,
    nextCheckSeconds: clampedNext,
    watching: parsed.watching,
    context: {
      perps,
      marketFeatures,
      risk,
      positionCount: positions.length,
      newsCount: (newsRes.results ?? []).length,
      tier: spec.id,
    },
  }).returning({ id: monitorTicks.id });

  await db.update(selboInstances).set({
    nextWatcherAt: new Date(Date.now() + clampedNext * 1000),
    currentlyWatching: parsed.watching,
  }).where(eq(selboInstances.id, instance.id));

  // Log the watcher LLM call (audit, admin-only surface). Skipped when the
  // verdict came from the deterministic risk-critical shortcut (no LLM ran).
  if (tickRow && llmCallTrace) {
    const trace = llmCallTrace as {
      rawResponse: string;
      promptTokens: number | undefined;
      completionTokens: number | undefined;
    };
    await logLlmCall({
      selboInstanceId: instance.id,
      tickId: tickRow.id,
      agentName: "watcher",
      model: MODELS.WATCHER,
      systemPrompt: WATCHER_SYSTEM_PROMPT,
      userMessage: userPayload,
      rawResponse: trace.rawResponse,
      parsedOutput: parsed,
      promptTokens: trace.promptTokens,
      completionTokens: trace.completionTokens,
    });
  }

  // Dispatch the trading action BEFORE anchoring -- the anchor is proof of
  // a decision already made, not a gate on it. If Circle is slow, the
  // Fast Trader / cycle trigger has already kicked off; the anchor await
  // below just keeps the worker alive long enough for both to land via
  // Cloudflare's scheduled() waitUntil envelope.
  if (parsed.verdict === "deliberate" && spec.panelDeliberations) {
    triggerCycleFromWatcher(instance as SelboInstance, parsed.rationale)
      .catch((e) => console.error("[watcher] cycle trigger failed:", e));
  } else if (parsed.verdict === "deliberate") {
    // Free tier: route deliberate to the cheap Fast Trader instead of the
    // expensive swarm. Better than dropping the signal entirely.
    runFastTraderForInstance(instance as SelboInstance, `[free-tier downgrade] ${parsed.rationale}`, tickRow?.id)
      .catch((e) => console.error("[watcher] fast-trader (downgrade) failed:", e));
  } else if (parsed.verdict === "execute" || parsed.verdict === "risk_emergency") {
    runFastTraderForInstance(instance as SelboInstance, parsed.rationale, tickRow?.id)
      .catch((e) => console.error("[watcher] fast-trader failed:", e));
  }

  // Arc anchor for execute / risk_emergency verdicts (M5). Runs LAST so
  // Circle latency cannot delay the trading action. `hold` is not anchored
  // (too noisy); `deliberate` is anchored downstream via the swarm cycle
  // path in orchestrator. Awaited so arcAnchorTx is saved before this
  // function returns -- on Cloudflare the cron handler's waitUntil keeps
  // the worker alive while we wait, which also lets the fire-and-forget
  // fast-trader / cycle dispatch above run to completion.
  if (
    tickRow &&
    (parsed.verdict === "execute" || parsed.verdict === "risk_emergency")
  ) {
    const tickId = tickRow.id;
    const contextDigest: AnchorJsonValue = {
      strategy: instance.strategyText,
      perps: perps as AnchorJsonValue,
      marketFeatures: marketFeatures as AnchorJsonValue,
      risk: risk as AnchorJsonValue,
      positions: positions as AnchorJsonValue,
      watching: parsed.watching,
      tier: spec.id,
    };
    try {
      const res = await anchorWatcherDecision({
        monitorTickId: tickId,
        verdict: parsed.verdict,
        rationale: parsed.rationale,
        contextDigest,
      });
      if (res?.txId) {
        await db
          .update(monitorTicks)
          .set({ arcAnchorTx: res.txId })
          .where(eq(monitorTicks.id, tickId));
      }
    } catch (err) {
      console.error("[watcher] anchorWatcherDecision failed:", err);
    }
  }

  return parsed;
}
