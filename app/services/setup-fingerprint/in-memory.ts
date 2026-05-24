import type { SetupRecordKind, LossesByReason } from "@/lib/db/schema/setup-records";
import type { RecordOutcomeInput } from "./index";
import { shapeRecordView, type SetupRecordView } from "./read";

/**
 * In-memory mirror of the live recordOutcome upsert. Used by the backtest
 * (no DB writes). MUST produce byte-identical state to the live upsert on
 * the same inputs -- this is asserted by the parity test.
 */
export type InMemoryRecord = {
  trades: number;
  wins: number;
  losses: number;
  sumR: number | null;
  rTrades: number;
  lossesByReason: LossesByReason;
  winsAfterStateShift: number;
  lossesAfterStateShift: number;
  lastFive: string;
};

export type InMemoryStore = {
  fpMap: Map<string, InMemoryRecord>;
  asMap: Map<string, InMemoryRecord>;
};

export function createInMemoryStore(): InMemoryStore {
  return { fpMap: new Map(), asMap: new Map() };
}

export function recordOutcomeInMemory(store: InMemoryStore, input: RecordOutcomeInput): void {
  const isWin = input.pnlUsd > 0;
  const isLoss = input.pnlUsd < 0;
  const outcome = isWin ? "W" : isLoss ? "L" : null;
  if (outcome === null) return;
  const rContribution = input.initialRiskUsd && input.initialRiskUsd > 0 ? input.pnlUsd / input.initialRiskUsd : null;
  const bucket: keyof LossesByReason | null = isLoss
    ? (input.exitReason === "stop_loss" ? "stop" : input.exitReason === null ? "manual" : null)
    : null;
  const shiftW = input.stateShifted && isWin ? 1 : 0;
  const shiftL = input.stateShifted && isLoss ? 1 : 0;

  const map = input.recordKind === "fingerprint" ? store.fpMap : store.asMap;
  const prev = map.get(input.recordKey);
  if (!prev) {
    map.set(input.recordKey, {
      trades: 1, wins: isWin ? 1 : 0, losses: isLoss ? 1 : 0,
      sumR: rContribution,
      rTrades: rContribution !== null ? 1 : 0,
      lossesByReason: {
        stop: bucket === "stop" ? 1 : 0,
        liquidation: 0,
        manual: bucket === "manual" ? 1 : 0,
        time: 0,
      },
      winsAfterStateShift: shiftW, lossesAfterStateShift: shiftL,
      lastFive: outcome,
    });
    return;
  }
  prev.trades += 1;
  prev.wins += isWin ? 1 : 0;
  prev.losses += isLoss ? 1 : 0;
  if (rContribution !== null) {
    prev.sumR = (prev.sumR ?? 0) + rContribution;
    prev.rTrades += 1;
  }
  if (bucket) prev.lossesByReason[bucket] += 1;
  prev.winsAfterStateShift += shiftW;
  prev.lossesAfterStateShift += shiftL;
  prev.lastFive = (prev.lastFive + outcome).slice(-5);
}

export function getInMemoryRecordView(
  store: InMemoryStore, kind: SetupRecordKind, key: string,
): SetupRecordView | null {
  const map = kind === "fingerprint" ? store.fpMap : store.asMap;
  const rec = map.get(key);
  if (!rec) return null;
  // Reuse the same gate + shaping logic as the live path. Pass a SetupRecord-
  // shaped object (the extra DB-only fields aren't read by shapeRecordView).
  return shapeRecordView({ ...rec, userId: "", recordKind: kind, recordKey: key, updatedAt: new Date() });
}
