import "server-only";

import { and, asc, eq, lt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { backtestRuns, dailyPlans } from "@/lib/db/schema";
import { fetchCandles, type Candle } from "@/lib/data-sources/hyperliquid";
import { closeAt, computePnl, STARTING_EQUITY_USD, type OpenPos } from "@/app/services/backtest/simulate-helpers";
import { simulateOneBacktestDay } from "@/app/services/backtest/simulate-day-step";

export type ActiveThesis = {
  thesisId: string; asset: string; side: "long" | "short";
  entryDate: string; entryPrice: number; sizeUsd: number; daysHeld: number;
  unrealizedPctFromEntry: number; originalConfidence: number;
  entryReason: string; invalidatesIf: string | null;
};
export type RecentOutcome = { asset: string; side: "long" | "short"; pnlPct: number; exitReason: string; closedAt: string; thesis: string };
export type ThesisMemory = { active: ActiveThesis[]; recent: RecentOutcome[] };

const candleCacheByRun = new Map<string, Map<string, Candle[]>>();

function pricePctMove(side: "long" | "short", entry: number, current: number): number {
  const m = side === "long" ? (current - entry) / entry : (entry - current) / entry;
  return m * 100;
}

function posToActive(pos: OpenPos, currentPrice: number, asOf: Date): ActiveThesis {
  return {
    thesisId: pos.thesisId, asset: pos.thesisId.split(":")[0], side: pos.side,
    entryDate: pos.entryDate.toISOString(), entryPrice: pos.entryPrice, sizeUsd: pos.sizeUsd,
    daysHeld: Math.max(0, Math.floor((asOf.getTime() - pos.entryDate.getTime()) / 86_400_000)),
    unrealizedPctFromEntry: pricePctMove(pos.side, pos.entryPrice, currentPrice),
    originalConfidence: pos.confidence, entryReason: pos.entryReason, invalidatesIf: pos.invalidatesIf,
  };
}

export async function buildBacktestThesisMemory(runId: string, asOf: Date): Promise<ThesisMemory> {
  const [run] = await db.select().from(backtestRuns).where(eq(backtestRuns.id, runId)).limit(1);
  if (!run) return { active: [], recent: [] };

  const priorPlans = await db.select().from(dailyPlans)
    .where(and(eq(dailyPlans.backtestRunId, runId), lt(dailyPlans.generatedAt, asOf)))
    .orderBy(asc(dailyPlans.generatedAt));
  if (priorPlans.length === 0) return { active: [], recent: [] };

  const cache = candleCacheByRun.get(runId) ?? new Map<string, Candle[]>();
  candleCacheByRun.set(runId, cache);
  const startMs = Date.parse(`${run.startDate}T00:00:00Z`);
  const endMs = Date.parse(`${run.endDate}T00:00:00Z`) + 2 * 86_400_000;
  const assets = Array.from(new Set(priorPlans.flatMap((p) => (p.planJson as { biasByAsset?: Array<{ asset: string }> } | null)?.biasByAsset?.map((b) => b.asset.toUpperCase()) ?? [])));
  for (const a of assets) if (!cache.has(a)) cache.set(a, await fetchCandles(a, "1d", startMs, endMs));

  const positions = new Map<string, OpenPos>();
  let equity = STARTING_EQUITY_USD;
  const allCloses: Array<{ ts: number; out: RecentOutcome }> = [];
  for (const plan of priorPlans) {
    const r = simulateOneBacktestDay({ plan, positions, candleCache: cache, equity });
    equity = r.newEquity;
    for (const c of r.closes) {
      const { pnlPct } = computePnl(c.pos.side, c.pos.entryPrice, c.exitPrice, c.pos.sizeUsd, c.pos.leverage);
      allCloses.push({ ts: c.exitDate.getTime(), out: { asset: c.asset, side: c.pos.side, pnlPct, exitReason: c.reason, closedAt: c.exitDate.toISOString(), thesis: c.pos.entryReason } });
    }
  }
  allCloses.sort((a, b) => b.ts - a.ts);
  const recent = allCloses.slice(0, 5).map((x) => x.out);

  const active: ActiveThesis[] = [];
  const yesterdayMs = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()) - 86_400_000;
  for (const pos of positions.values()) {
    const asset = pos.thesisId.split(":")[0];
    const candles = cache.get(asset);
    const price = candles ? closeAt(candles, yesterdayMs) ?? pos.entryPrice : pos.entryPrice;
    active.push(posToActive(pos, price, asOf));
  }
  return { active, recent };
}

export { buildLiveThesisMemory } from "./build-thesis-memory-live";

function portfolioSummary(active: ActiveThesis[]): string {
  if (active.length === 0) return "## Portfolio summary\n(no open positions)\n";
  const longs = active.filter((a) => a.side === "long");
  const gross = active.reduce((s, a) => s + a.sizeUsd, 0);
  const net = active.reduce((s, a) => s + (a.side === "long" ? a.sizeUsd : -a.sizeUsd), 0);
  const ratio = gross > 0 ? Math.abs(net) / gross : 0;
  const dir = ratio < 0.2 ? "balanced" : net > 0 ? "net_long" : "net_short";
  const dom = active.reduce((m, a) => a.sizeUsd > m.sizeUsd ? a : m, active[0]);
  return `## Portfolio summary\n- openPositions=${active.length} (longs=${longs.length}, shorts=${active.length - longs.length})\n- grossNotionalPctOfStartingEquity=${(gross / STARTING_EQUITY_USD * 100).toFixed(1)}%\n- direction=${dir} (netRatio=${ratio.toFixed(2)})\n- dominantAsset=${dom.asset} (size $${dom.sizeUsd.toFixed(0)})\n`;
}

export function formatThesisMemoryForPrompt(m: ThesisMemory): string {
  if (m.active.length === 0 && m.recent.length === 0) return `${portfolioSummary(m.active)}\n## Active theses\n(none)\n`;
  const activeLines = m.active.length === 0 ? "(none)" : m.active.map((a) =>
    `- thesisId=${a.thesisId} | ${a.asset} ${a.side} | sizeUsd=${a.sizeUsd.toFixed(0)} | daysHeld=${a.daysHeld} | entryPrice=${a.entryPrice.toFixed(2)} | unrealizedPctFromEntry=${a.unrealizedPctFromEntry.toFixed(2)}% | originalConfidence=${a.originalConfidence.toFixed(2)} | invalidatesIf=${a.invalidatesIf ? `"${a.invalidatesIf}"` : "null"} | entryReason="${a.entryReason}"`
  ).join("\n");
  const recentLines = m.recent.length === 0 ? "(none)" : m.recent.map((r) =>
    `- ${r.closedAt.slice(0, 10)} | ${r.asset} ${r.side} | pnlPct=${r.pnlPct.toFixed(2)}% | exitReason=${r.exitReason} | thesis="${r.thesis}"`
  ).join("\n");
  return `${portfolioSummary(m.active)}\n## Active theses (review FIRST)\n${activeLines}\n\n## Recent outcomes\n${recentLines}\n`;
}
