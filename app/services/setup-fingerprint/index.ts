import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { setupRecords, type SetupRecordKind, type LossesByReason } from "@/lib/db/schema/setup-records";
import type { PerpMarketState } from "@/lib/perp-market-state";
import { deriveEntryState, type EntryStateSnapshot } from "./derive";

export type { EntryStateSnapshot } from "./derive";
export { deriveEntryState, deriveStateShifted, computeInitialRiskUsd } from "./derive";
export { MIN_TRADES_TO_EXPOSE, shapeRecordView, loadUserRecords, type SetupRecordView } from "./read";

export function computeFingerprint(opts: {
  asset: string; side: "long" | "short"; entryState: EntryStateSnapshot;
}): string {
  const { asset, side, entryState: s } = opts;
  return `${asset.toUpperCase()}|${side}|${s.valueLocation}|${s.volumeState}|${s.oiFlow}|${s.fundingState}`;
}

export function computeAssetSideKey(asset: string, side: "long" | "short"): string {
  return `${asset.toUpperCase()}|${side}`;
}

export function computeFingerprintFromMarketState(opts: {
  asset: string; side: "long" | "short"; perp: PerpMarketState; recentCandles: ReadonlyArray<{ v: number }>;
}): string {
  return computeFingerprint({ asset: opts.asset, side: opts.side, entryState: deriveEntryState(opts.perp, opts.recentCandles) });
}

export type RecordOutcomeInput = {
  userId: string; recordKind: SetupRecordKind; recordKey: string;
  pnlUsd: number; initialRiskUsd: number | null;
  exitReason: "stop_loss" | "take_profit" | null; stateShifted: boolean;
};

/**
 * Atomic upsert via drizzle onConflictDoUpdate. Concurrent closes on the same
 * (userId, recordKind, recordKey) cannot drop counts. The live ledger and the
 * backtest in-memory mirror must produce byte-identical state on the same
 * inputs (asserted by the parity test).
 */
export async function recordOutcome(input: RecordOutcomeInput): Promise<void> {
  const isWin = input.pnlUsd > 0;
  const isLoss = input.pnlUsd < 0;
  const outcome = isWin ? "W" : isLoss ? "L" : null;
  if (outcome === null) return; // zero pnl: no-op, do not pollute lastFive
  const rContribution = input.initialRiskUsd && input.initialRiskUsd > 0 ? input.pnlUsd / input.initialRiskUsd : null;
  const bucket: keyof LossesByReason | null = isLoss
    ? (input.exitReason === "stop_loss" ? "stop" : input.exitReason === null ? "manual" : null)
    : null;
  const shiftW = input.stateShifted && isWin ? 1 : 0;
  const shiftL = input.stateShifted && isLoss ? 1 : 0;
  // bucket narrows to "stop" | "manual" | null today (exitReason can only be
  // stop_loss/take_profit/null). liquidation/time slots are forward-compat
  // for live execution modes that don't exist yet -- always 0 here.
  const seedLBR: LossesByReason = {
    stop: bucket === "stop" ? 1 : 0,
    liquidation: 0,
    manual: bucket === "manual" ? 1 : 0,
    time: 0,
  };

  const rTradesInc = rContribution !== null ? 1 : 0;
  await db.insert(setupRecords).values({
    userId: input.userId, recordKind: input.recordKind, recordKey: input.recordKey,
    trades: 1, wins: isWin ? 1 : 0, losses: isLoss ? 1 : 0,
    sumR: rContribution, rTrades: rTradesInc, lossesByReason: seedLBR,
    winsAfterStateShift: shiftW, lossesAfterStateShift: shiftL,
    lastFive: outcome,
  }).onConflictDoUpdate({
    target: [setupRecords.userId, setupRecords.recordKind, setupRecords.recordKey],
    set: {
      trades: sql`${setupRecords.trades} + 1`,
      wins: sql`${setupRecords.wins} + ${isWin ? 1 : 0}`,
      losses: sql`${setupRecords.losses} + ${isLoss ? 1 : 0}`,
      sumR: rContribution !== null ? sql`coalesce(${setupRecords.sumR}, 0) + ${rContribution}` : sql`${setupRecords.sumR}`,
      rTrades: sql`${setupRecords.rTrades} + ${rTradesInc}`,
      lossesByReason: bucket ? sql`${setupRecords.lossesByReason} || jsonb_build_object(${bucket}::text, (coalesce((${setupRecords.lossesByReason}->>${bucket})::int, 0) + 1))` : sql`${setupRecords.lossesByReason}`,
      winsAfterStateShift: sql`${setupRecords.winsAfterStateShift} + ${shiftW}`,
      lossesAfterStateShift: sql`${setupRecords.lossesAfterStateShift} + ${shiftL}`,
      lastFive: sql`right(${setupRecords.lastFive} || ${outcome}, 5)`,
      updatedAt: sql`now()`,
    },
  });
}
