import "server-only";

import { db } from "@/lib/db/client";
import { monitorTicks, solonInstances, type SolonInstance } from "@/lib/db/schema";
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

/**
 * Run one watcher tick for a given Solon instance. Reads Hyperliquid mark
 * prices, funding rates, and the user's open positions, plus recent news,
 * then asks the watcher to classify the tick. Persists the verdict,
 * advances next_watcher_at, and on `execute` or `deliberate` routes to the
 * appropriate downstream tier.
 */
export async function runWatcherForInstance(instanceId: string): Promise<WatcherOutput> {
  const [instance] = await db
    .select().from(solonInstances).where(eq(solonInstances.id, instanceId)).limit(1);
  if (!instance) throw new Error(`solon_instances ${instanceId} not found`);
  if (instance.killSwitchActive) throw new Error("kill switch active, refusing to tick");

  const watching = instance.currentlyWatching ?? ["ETH", "BTC", "SOL"];

  const [mids, meta, clearing, newsRes, lastTick] = await Promise.all([
    fetchAllMids().catch(() => ({} as Awaited<ReturnType<typeof fetchAllMids>>)),
    fetchMetaAndCtxs().catch(() => ({ universe: [], ctxs: [] })),
    fetchClearinghouse(instance.circleWalletAddress).catch(() => null),
    searchNews(`${watching.join(" OR ")} OR perp OR crypto`)
      .catch(() => ({ results: [] as Array<{ title: string; source: string; publishedAt: string }> })),
    db.select().from(monitorTicks)
      .where(eq(monitorTicks.solonInstanceId, instance.id))
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

  await db.insert(monitorTicks).values({
    solonInstanceId: instance.id,
    verdict: parsed.verdict,
    rationale: parsed.rationale,
    nextCheckSeconds: parsed.nextCheckSeconds,
    watching: parsed.watching,
    context: { perps, positionCount: positions.length, newsCount: (newsRes.results ?? []).length },
  });

  await db.update(solonInstances).set({
    nextWatcherAt: new Date(Date.now() + parsed.nextCheckSeconds * 1000),
    currentlyWatching: parsed.watching,
  }).where(eq(solonInstances.id, instance.id));

  if (parsed.verdict === "deliberate") {
    triggerCycleFromWatcher(instance as SolonInstance, parsed.rationale)
      .catch((e) => console.error("[watcher] cycle trigger failed:", e));
  } else if (parsed.verdict === "execute") {
    // Fast Trader service lands next commit. Log for now.
    console.log(`[watcher] EXECUTE verdict on ${instance.id}: ${parsed.rationale} (fast-trader service pending)`);
  }

  return parsed;
}
