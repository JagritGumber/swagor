import type { Candle } from "@/lib/data-sources/hyperliquid";
import { checkStopTpHit, trailingStopHit, closeRealizedPnl, computePnl, type OpenPos } from "@/app/services/backtest/simulate-helpers";
import { summarizeBacktestTrades } from "@/app/services/backtest/summarize-trades";
import {
  computeFingerprint, computeAssetSideKey, computeInitialRiskUsd,
  deriveEntryState, deriveStateShifted, MIN_TRADES_TO_EXPOSE,
  shapeRecordView, type EntryStateSnapshot,
} from "@/app/services/setup-fingerprint";
import { deriveVolumeState, deriveFundingState } from "@/app/services/setup-fingerprint/derive";
import { createInMemoryStore, recordOutcomeInMemory, getInMemoryRecordView } from "@/app/services/setup-fingerprint/in-memory";
import type { PerpMarketState } from "@/lib/perp-market-state";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean): void {
  if (cond) { pass++; } else { fail++; console.error("FAIL:", name); }
}
const approx = (a: number, b: number) => Math.abs(a - b) < 1e-6;

function pos(p: Partial<OpenPos> & Pick<OpenPos, "side" | "entryPrice" | "stopPrice" | "tpPrice">): OpenPos {
  return { sizeUsd: 100, leverage: 1, confidence: 0.7, entryDate: new Date(0), thesisId: "t", entryReason: "r", invalidatesIf: null, ...p };
}
const candle = (c: number): Candle => ({ t: 0, T: 0, s: "X", i: "1h", o: "0", c: String(c), h: "0", l: "0", v: "0", n: 0 });

// --- computePnl ---
check("pnl long win", approx(computePnl("long", 100, 110, 100, 1).pnlUsd, 10));
check("pnl short win", approx(computePnl("short", 100, 90, 100, 1).pnlUsd, 10));
check("pnl long loss", approx(computePnl("long", 100, 90, 100, 1).pnlUsd, -10));
check("pnl leverage scales", approx(computePnl("long", 100, 110, 100, 3).pnlUsd, 30));

// --- closeRealizedPnl (subtracts 0.1 round-trip cost) ---
check("close pnl nets cost", approx(closeRealizedPnl(pos({ side: "long", entryPrice: 100, stopPrice: 95, tpPrice: 110 }), 110), 9.9));
check("close pnl loss + cost", approx(closeRealizedPnl(pos({ side: "long", entryPrice: 100, stopPrice: 95, tpPrice: 110 }), 90), -10.1));

// --- checkStopTpHit (daily-close only) ---
const long = pos({ side: "long", entryPrice: 100, stopPrice: 95, tpPrice: 110 });
check("long stop on close<=stop", checkStopTpHit(long, candle(94))?.reason === "stop_loss");
check("long tp on close>=tp", checkStopTpHit(long, candle(111))?.reason === "take_profit");
check("long no hit inside band", checkStopTpHit(long, candle(100)) === null);
const short = pos({ side: "short", entryPrice: 100, stopPrice: 105, tpPrice: 90 });
check("short stop on close>=stop", checkStopTpHit(short, candle(106))?.reason === "stop_loss");
check("short tp on close<=tp", checkStopTpHit(short, candle(89))?.reason === "take_profit");
const thesis = pos({ side: "long", entryPrice: 100, stopPrice: 90, tpPrice: 120, invalidationLevel: 96 });
check("thesis invalidation precedes stop", checkStopTpHit(thesis, candle(95))?.reason === "thesis_invalidated");

// --- trailingStopHit (lock profit, exit on giveback from peak) ---
const tLong = pos({ side: "long", entryPrice: 100, stopPrice: 90, tpPrice: 130, peakPrice: 103 });
check("trail long fires on giveback from peak", trailingStopHit(tLong, 100.9) === true);
check("trail long holds near peak", trailingStopHit(tLong, 102.5) === false);
check("trail not armed before trigger", trailingStopHit(pos({ side: "long", entryPrice: 100, stopPrice: 90, tpPrice: 130, peakPrice: 101 }), 99.5) === false);
check("trail short fires on giveback", trailingStopHit(pos({ side: "short", entryPrice: 100, stopPrice: 110, tpPrice: 70, peakPrice: 96 }), 98.1) === true);

// Discipline gates removed: the agent decides direction/size/stops now, so
// there is no scalperLongBlocks to assert. The surviving deterministic logic
// below is the no-blowup math (pnl, stop/tp, summary) - that still holds.

// --- setup-fingerprint: derive helpers ---
const baseVol = Array.from({ length: 10 }, () => ({ v: 100 }));
check("vol spike (>=2.0x)", deriveVolumeState([...baseVol, { v: 220 }]) === "spike");
check("vol expanding (>=1.2x)", deriveVolumeState([...baseVol, { v: 150 }]) === "expanding");
check("vol contracting (<=0.8x)", deriveVolumeState([...baseVol, { v: 70 }]) === "contracting");
check("vol normal", deriveVolumeState([...baseVol, { v: 100 }]) === "normal");
check("vol unknown when too few candles", deriveVolumeState([{ v: 100 }]) === "unknown");
check("funding extreme_positive -> extreme", deriveFundingState("extreme_positive") === "extreme");
check("funding extreme_negative -> extreme", deriveFundingState("extreme_negative") === "extreme");
check("funding positive -> long_pays", deriveFundingState("positive") === "long_pays");
check("funding negative -> short_pays", deriveFundingState("negative") === "short_pays");
check("funding neutral -> neutral", deriveFundingState("neutral") === "neutral");
check("funding unknown -> neutral", deriveFundingState("unknown") === "neutral");

// --- computeInitialRiskUsd: stop-side sanity ---
check("risk long valid (size 100, entry 1000, stop 980 -> $2)", computeInitialRiskUsd({ side: "long", entryPrice: 1000, stopPrice: 980, sizeUsd: 100 }) === 2);
check("risk short valid (size 100, entry 1000, stop 1020 -> $2)", computeInitialRiskUsd({ side: "short", entryPrice: 1000, stopPrice: 1020, sizeUsd: 100 }) === 2);
check("risk long wrong-side stop -> null", computeInitialRiskUsd({ side: "long", entryPrice: 1000, stopPrice: 1020, sizeUsd: 100 }) === null);
check("risk short wrong-side stop -> null", computeInitialRiskUsd({ side: "short", entryPrice: 1000, stopPrice: 980, sizeUsd: 100 }) === null);
check("risk null stop -> null", computeInitialRiskUsd({ side: "long", entryPrice: 1000, stopPrice: null, sizeUsd: 100 }) === null);
check("risk zero size -> null", computeInitialRiskUsd({ side: "long", entryPrice: 1000, stopPrice: 980, sizeUsd: 0 }) === null);

// --- fingerprint determinism + key shape ---
const entryState: EntryStateSnapshot = { valueLocation: "near_vah", volumeState: "spike", oiFlow: "rising", fundingState: "extreme" };
const fp = computeFingerprint({ asset: "btc", side: "short", entryState });
check("fingerprint string", fp === "BTC|short|near_vah|spike|rising|extreme");
check("fingerprint deterministic", computeFingerprint({ asset: "BTC", side: "short", entryState }) === fp);
check("asset_side key shape", computeAssetSideKey("eth", "long") === "ETH|long");

// --- deriveEntryState integration ---
const perpStub: PerpMarketState = {
  symbol: "BTC", dataQuality: "complete", regime: "trend_up", valueLocation: "near_vah",
  auctionState: "accepted_above_value", structureState: "breakout",
  levels: { vwap: 1000, poc: 1000, vah: 1010, val: 990, rangeHigh: 1020, rangeLow: 980, swingHigh: null, swingLow: null },
  derivativesFlow: { fundingState: "extreme_positive", oiState: "rising", flowRead: "long_building", fundingCostWarning: true },
  liquidity: { spreadRisk: "low", bookImbalance: "balanced", liquidationClusterBias: "none" },
  strategyMode: "swing", executionQuality: "good", permission: "allow_long", setupCandidates: [], helperContext: "", brief: "",
};
const derived = deriveEntryState(perpStub, [...baseVol, { v: 220 }]);
check("deriveEntryState valueLocation", derived.valueLocation === "near_vah");
check("deriveEntryState volumeState", derived.volumeState === "spike");
check("deriveEntryState oiFlow", derived.oiFlow === "rising");
check("deriveEntryState fundingState collapsed", derived.fundingState === "extreme");

// --- stateShifted diff ---
const closeStateSame: EntryStateSnapshot = { ...derived };
const closeStateDiff: EntryStateSnapshot = { ...derived, valueLocation: "below_value" };
check("stateShifted false when same", deriveStateShifted(derived, closeStateSame) === false);
check("stateShifted true when any dim differs", deriveStateShifted(derived, closeStateDiff) === true);

// --- recordOutcomeInMemory: 10-trade scenario + N>=3 gate + R math + state shift + lastFive rotation ---
const store = createInMemoryStore();
const key = "BTC|short|near_vah|spike|rising|extreme";
// Trade 1: win, R=+2.0, no shift
recordOutcomeInMemory(store, { userId: "u", recordKind: "fingerprint", recordKey: key, pnlUsd: 4, initialRiskUsd: 2, exitReason: "take_profit", stateShifted: false });
check("after 1 trade view is null (gate at <3)", getInMemoryRecordView(store, "fingerprint", key) === null);
// Trade 2: loss, R=-1.0, stop_loss, no shift
recordOutcomeInMemory(store, { userId: "u", recordKind: "fingerprint", recordKey: key, pnlUsd: -2, initialRiskUsd: 2, exitReason: "stop_loss", stateShifted: false });
check("after 2 trades view is null", getInMemoryRecordView(store, "fingerprint", key) === null);
// Trade 3: loss, R=-1.5, stop_loss, state shifted
recordOutcomeInMemory(store, { userId: "u", recordKind: "fingerprint", recordKey: key, pnlUsd: -3, initialRiskUsd: 2, exitReason: "stop_loss", stateShifted: true });
const view3 = getInMemoryRecordView(store, "fingerprint", key);
check("after 3 trades view populates (gate met)", view3 !== null && view3.trades === 3 && view3.wins === 1 && view3.losses === 2);
check("avg_r = (2 + -1 + -1.5)/3 = -0.1666...", view3 !== null && approx(view3.avg_r ?? 0, -1 / 6));
check("lossesByReason.stop = 2", view3 !== null && view3.lossesByReason.stop === 2);
check("lossesByReason.manual = 0", view3 !== null && view3.lossesByReason.manual === 0);
check("lossesAfterStateShift = 1", view3 !== null && view3.lossesAfterStateShift === 1);
check("winsAfterStateShift = 0", view3 !== null && view3.winsAfterStateShift === 0);
check("lastFive after 3 = WLL", view3 !== null && view3.lastFive === "WLL");
// Trade 4: win, manual close (no exitReason), no shift -- proves lossesByReason untouched on wins
recordOutcomeInMemory(store, { userId: "u", recordKind: "fingerprint", recordKey: key, pnlUsd: 5, initialRiskUsd: 2, exitReason: null, stateShifted: false });
const view4 = getInMemoryRecordView(store, "fingerprint", key);
check("win does not touch lossesByReason", view4 !== null && view4.lossesByReason.stop === 2 && view4.lossesByReason.manual === 0);
// Trade 5: loss, manual close (agent), state shifted
recordOutcomeInMemory(store, { userId: "u", recordKind: "fingerprint", recordKey: key, pnlUsd: -1, initialRiskUsd: 2, exitReason: null, stateShifted: true });
const view5 = getInMemoryRecordView(store, "fingerprint", key);
check("manual loss buckets to manual", view5 !== null && view5.lossesByReason.manual === 1);
check("lastFive after 5 = WLLWL", view5 !== null && view5.lastFive === "WLLWL");
// Trade 6: zero-pnl (no-op, must not pollute lastFive)
recordOutcomeInMemory(store, { userId: "u", recordKind: "fingerprint", recordKey: key, pnlUsd: 0, initialRiskUsd: 2, exitReason: null, stateShifted: false });
const view6 = getInMemoryRecordView(store, "fingerprint", key);
check("zero pnl is no-op (trades unchanged)", view6 !== null && view6.trades === 5);
check("zero pnl does not touch lastFive", view6 !== null && view6.lastFive === "WLLWL");
// Trade 7: win with null initialRiskUsd (garbage stop) -- counts in trades/wins, NOT in sumR
recordOutcomeInMemory(store, { userId: "u", recordKind: "fingerprint", recordKey: key, pnlUsd: 3, initialRiskUsd: null, exitReason: "take_profit", stateShifted: false });
const view7 = getInMemoryRecordView(store, "fingerprint", key);
const expectedSumR = 2 + -1 + -1.5 + 2.5 + -0.5; // 5 contributing trades; trade 7 has null initialRiskUsd so doesn't contribute
check("garbage stop: trades increments", view7 !== null && view7.trades === 6);
check("garbage stop: wins increments", view7 !== null && view7.wins === 3);
check("garbage stop: rTrades does NOT increment", view7 !== null && view7.rTrades === 5);
check("garbage stop: avg_r = sumR/rTrades, NOT sumR/trades (no dilution)", view7 !== null && approx(view7.avg_r ?? 0, expectedSumR / 5));
// Trade 8-10: extend to verify lastFive rotation drops oldest
recordOutcomeInMemory(store, { userId: "u", recordKind: "fingerprint", recordKey: key, pnlUsd: 1, initialRiskUsd: 2, exitReason: null, stateShifted: false });
recordOutcomeInMemory(store, { userId: "u", recordKind: "fingerprint", recordKey: key, pnlUsd: -1, initialRiskUsd: 2, exitReason: "stop_loss", stateShifted: false });
recordOutcomeInMemory(store, { userId: "u", recordKind: "fingerprint", recordKey: key, pnlUsd: 2, initialRiskUsd: 2, exitReason: null, stateShifted: false });
const view10 = getInMemoryRecordView(store, "fingerprint", key);
// Sequence of W/L outcomes from trade 1: W,L,L,W,L, (skipped 0-pnl), W, W, L, W -> last 5 are "WWLWLW"... wait recount
// 1:W 2:L 3:L 4:W 5:L 6:skip 7:W 8:W 9:L 10:W -> 9 non-skip outcomes: W L L W L W W L W -> last 5: "L W W L W" = "LWWLW"
check("lastFive after 10 (9 non-skip) = LWWLW", view10 !== null && view10.lastFive === "LWWLW");

// --- shapeRecordView gate direct test ---
check("shapeRecordView null at trades=2", shapeRecordView({ userId: "u", recordKind: "fingerprint", recordKey: "x", trades: 2, wins: 1, losses: 1, sumR: null, rTrades: 0, lossesByReason: { stop: 0, liquidation: 0, manual: 0, time: 0 }, winsAfterStateShift: 0, lossesAfterStateShift: 0, lastFive: "WL", updatedAt: new Date() }) === null);
check("MIN_TRADES_TO_EXPOSE = 3", MIN_TRADES_TO_EXPOSE === 3);

// --- summarizeBacktestTrades ---
const sum = summarizeBacktestTrades([{ pnlUsd: "5" }, { pnlUsd: "-3" }, { pnlUsd: "0" }, { pnlUsd: null }]);
check("summary counts", sum.totalTrades === 3 && sum.wins === 1 && sum.losses === 1 && sum.flat === 1);
check("summary totals", approx(sum.totalPnlUsd, 2) && approx(sum.bestPnlUsd, 5) && approx(sum.worstPnlUsd, -3));
check("summary win rate", approx(sum.winRate, 1 / 3));

console.log(`\n${fail === 0 ? "PASS" : "FAIL"}: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);


