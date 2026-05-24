import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { setupRecords, type SetupRecord, type LossesByReason } from "@/lib/db/schema/setup-records";

/**
 * Records are EXPOSED to the agent only when trades >= MIN_TRADES_TO_EXPOSE.
 * 3 = minimum where the outcome distribution can have shape (a streak vs not,
 * multiple lossesByReason buckets possible, winsAfterStateShift vs losses can
 * disagree). NOT a statistical confidence threshold. Surfaced here so it is
 * tunable from one place.
 */
export const MIN_TRADES_TO_EXPOSE = 3;

export type SetupRecordView = {
  trades: number;
  wins: number;
  losses: number;
  avg_r: number | null;
  rTrades: number;
  lossesByReason: LossesByReason;
  winsAfterStateShift: number;
  lossesAfterStateShift: number;
  lastFive: string;
};

export function shapeRecordView(row: SetupRecord | undefined): SetupRecordView | null {
  if (!row || row.trades < MIN_TRADES_TO_EXPOSE) return null;
  return {
    trades: row.trades, wins: row.wins, losses: row.losses,
    avg_r: row.sumR !== null && row.rTrades > 0 ? row.sumR / row.rTrades : null,
    rTrades: row.rTrades,
    lossesByReason: row.lossesByReason,
    winsAfterStateShift: row.winsAfterStateShift, lossesAfterStateShift: row.lossesAfterStateShift,
    lastFive: row.lastFive,
  };
}

export async function loadUserRecords(userId: string): Promise<{
  fpMap: Map<string, SetupRecordView>; asMap: Map<string, SetupRecordView>;
}> {
  const rows = await db.select().from(setupRecords).where(eq(setupRecords.userId, userId));
  const fpMap = new Map<string, SetupRecordView>();
  const asMap = new Map<string, SetupRecordView>();
  for (const row of rows) {
    const view = shapeRecordView(row);
    if (!view) continue;
    (row.recordKind === "fingerprint" ? fpMap : asMap).set(row.recordKey, view);
  }
  return { fpMap, asMap };
}
