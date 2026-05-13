import "server-only";

import { db } from "@/lib/db/client";
import { monitorTicks, solonInstances, type SolonInstance } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { watcherLlm, MODELS } from "@/lib/llm-client";
import { fetchPrices } from "@/lib/data-sources/coingecko";
import { searchNews } from "@/lib/data-sources/news";
import { WATCHER_SCHEMA, WATCHER_SYSTEM_PROMPT, type WatcherOutput } from "./prompt";
import { triggerCycleFromWatcher } from "./trigger";

// CoinGecko id mapping for the watchlist symbols.
const COIN_IDS: Record<string, string> = {
  ETH: "ethereum", BTC: "bitcoin", SOL: "solana",
  USDC: "usd-coin", USDT: "tether", DAI: "dai",
  AVAX: "avalanche-2", MATIC: "matic-network", LINK: "chainlink",
};

function coinIdFor(sym: string): string {
  return COIN_IDS[sym.toUpperCase()] ?? sym.toLowerCase();
}

/**
 * Run one watcher tick for a given Solon instance.
 * Gathers context, calls the cheap model, persists the verdict, advances
 * next_watcher_at by the agent-chosen delay, and on escalate fires the full
 * panel via the orchestrator (fire-and-forget).
 */
export async function runWatcherForInstance(instanceId: string): Promise<WatcherOutput> {
  const [instance] = await db
    .select().from(solonInstances).where(eq(solonInstances.id, instanceId)).limit(1);
  if (!instance) throw new Error(`solon_instances ${instanceId} not found`);
  if (instance.killSwitchActive) throw new Error("kill switch active, refusing to tick");

  const watching = instance.currentlyWatching ?? ["ETH", "BTC", "SOL"];
  const ids = watching.map(coinIdFor);

  const [prices, newsRes, lastTick] = await Promise.all([
    fetchPrices(ids).catch(() => ({} as Awaited<ReturnType<typeof fetchPrices>>)),
    searchNews(`${watching.join(" OR ")} OR crypto`).catch(() => ({ results: [] as Array<{ title: string; source: string; publishedAt: string }> })),
    db.select().from(monitorTicks)
      .where(eq(monitorTicks.solonInstanceId, instance.id))
      .orderBy(desc(monitorTicks.createdAt)).limit(1).then((r) => r[0]),
  ]);

  const userPayload = JSON.stringify({
    strategy: instance.strategyText,
    watching,
    prices,
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
    context: { prices, newsCount: (newsRes.results ?? []).length, strategy: instance.strategyText },
  });

  await db.update(solonInstances).set({
    nextWatcherAt: new Date(Date.now() + parsed.nextCheckSeconds * 1000),
    currentlyWatching: parsed.watching,
  }).where(eq(solonInstances.id, instance.id));

  if (parsed.verdict === "escalate") {
    // Fire-and-forget. The orchestrator self-anchors and updates cycle status.
    triggerCycleFromWatcher(instance as SolonInstance, parsed.rationale)
      .catch((e) => console.error("[watcher] cycle trigger failed:", e));
  }

  return parsed;
}
