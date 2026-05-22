import { extractTradeLessons } from "@/app/services/memory-lessons";
import type { OpenPos } from "./simulate-helpers";

const MAX_LESSONS = 12;

/**
 * After a backtest close, extract a lesson and feed it forward into
 * ctx.recentLessons so the agent evolves WITHIN the run - the same memory
 * mechanism the live watcher uses (getRecentLessons), but in-memory. Without
 * this the replay agent has zero recall of its own trades and repeats the
 * same mistake every tick. Newest lessons first, capped. Best-effort: a
 * memory failure must never break the replay.
 */
export async function appendReplayLesson(
  ctx: { recentLessons?: string[] },
  asset: string,
  pos: OpenPos,
  exitPrice: number,
  pnlUsd: number,
  reason: string,
): Promise<void> {
  const pnlPct = pos.sizeUsd > 0 ? (pnlUsd / pos.sizeUsd) * 100 : null;
  try {
    const { lessons } = await extractTradeLessons({
      asset, side: pos.side, sizeUsd: pos.sizeUsd,
      entryPrice: pos.entryPrice, exitPrice, pnlUsd, pnlPct,
      entryReason: pos.entryReason, setupType: pos.setupType ?? null, exitReason: reason,
    });
    ctx.recentLessons = [...lessons, ...(ctx.recentLessons ?? [])].slice(0, MAX_LESSONS);
  } catch {
    /* memory is best-effort; never break the replay */
  }
}
