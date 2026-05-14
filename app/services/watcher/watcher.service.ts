import "server-only";

import { db } from "@/lib/db/client";
import { monitorTicks, selboInstances, type SelboInstance } from "@/lib/db/schema";
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

  const positions = clearing?.assetPositions.map((p) => ({
    coin: p.position.coin,
    size: p.position.szi,
    entry: p.position.entryPx,
    leverage: p.position.leverage,
    liquidation: p.position.liquidationPx,
    unrealized_pnl: p.position.unrealizedPnl,
    margin_used: p.position.marginUsed,
  })) ?? [];

  const userPayload = JSON.stringify({
    strategy: instance.strategyText,
    watching,
    account: clearing
      ? { equity: clearing.marginSummary.accountValue, withdrawable: clearing.withdrawable }
      : null,
    positions,
    perps,
    news: (newsRes.results ?? []).slice(0, 6).map((n) => ({
      title: n.title, source: n.source,
      hoursAgo: n.publishedAt ? Math.floor((Date.now() - new Date(n.publishedAt).getTime()) / 3_600_000) : null,
    })),
    lastVerdict: lastTick?.verdict ?? null,
    minutesSinceLastTick: lastTick ? Math.floor((Date.now() - new Date(lastTick.createdAt).getTime()) / 60_000) : null,
  });

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
  const parsed = WATCHER_SCHEMA.parse(JSON.parse(raw));

  // Apply per-tier cadence floor: free users tick less often than basic+.
  const spec = tierSpec(instance.subscriptionTier as Tier);
  const clampedNext = Math.min(
    Math.max(parsed.nextCheckSeconds, spec.watcherMinCadenceSeconds),
    spec.watcherMaxCadenceSeconds,
  );

  await db.insert(monitorTicks).values({
    selboInstanceId: instance.id,
    verdict: parsed.verdict,
    rationale: parsed.rationale,
    nextCheckSeconds: clampedNext,
    watching: parsed.watching,
    context: { perps, positionCount: positions.length, newsCount: (newsRes.results ?? []).length, tier: spec.id },
  });

  await db.update(selboInstances).set({
    nextWatcherAt: new Date(Date.now() + clampedNext * 1000),
    currentlyWatching: parsed.watching,
  }).where(eq(selboInstances.id, instance.id));

  if (parsed.verdict === "deliberate" && spec.panelDeliberations) {
    triggerCycleFromWatcher(instance as SelboInstance, parsed.rationale)
      .catch((e) => console.error("[watcher] cycle trigger failed:", e));
  } else if (parsed.verdict === "deliberate") {
    // Free tier: route deliberate to the cheap Fast Trader instead of the
    // expensive swarm. Better than dropping the signal entirely.
    runFastTraderForInstance(instance as SelboInstance, `[free-tier downgrade] ${parsed.rationale}`)
      .catch((e) => console.error("[watcher] fast-trader (downgrade) failed:", e));
  } else if (parsed.verdict === "execute") {
    runFastTraderForInstance(instance as SelboInstance, parsed.rationale)
      .catch((e) => console.error("[watcher] fast-trader failed:", e));
  }

  return parsed;
}
