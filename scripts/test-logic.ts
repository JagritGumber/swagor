import type { Candle } from "@/lib/data-sources/hyperliquid";
import { checkStopTpHit, trailingStopHit, closeRealizedPnl, computePnl, type OpenPos } from "@/app/services/backtest/simulate-helpers";
import { summarizeBacktestTrades } from "@/app/services/backtest/summarize-trades";

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

// --- summarizeBacktestTrades ---
const sum = summarizeBacktestTrades([{ pnlUsd: "5" }, { pnlUsd: "-3" }, { pnlUsd: "0" }, { pnlUsd: null }]);
check("summary counts", sum.totalTrades === 3 && sum.wins === 1 && sum.losses === 1 && sum.flat === 1);
check("summary totals", approx(sum.totalPnlUsd, 2) && approx(sum.bestPnlUsd, 5) && approx(sum.worstPnlUsd, -3));
check("summary win rate", approx(sum.winRate, 1 / 3));

console.log(`\n${fail === 0 ? "PASS" : "FAIL"}: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
