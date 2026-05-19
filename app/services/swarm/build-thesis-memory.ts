import "server-only";

const STARTING_EQUITY_USD = 1000;

export type ActiveThesis = {
  thesisId: string; asset: string; side: "long" | "short";
  entryDate: string; entryPrice: number; sizeUsd: number; daysHeld: number;
  unrealizedPctFromEntry: number; originalConfidence: number;
  entryReason: string; invalidatesIf: string | null;
};
export type RecentOutcome = { asset: string; side: "long" | "short"; pnlPct: number; exitReason: string; closedAt: string; thesis: string };
export type ThesisMemory = { active: ActiveThesis[]; recent: RecentOutcome[] };

export async function buildBacktestThesisMemory(): Promise<ThesisMemory> {
  return { active: [], recent: [] };
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
