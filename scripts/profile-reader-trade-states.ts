import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

type TradeTapeFile = {
  assets: Array<{
    trades: ReaderTrade[];
  }>;
};

type ReaderTrade = {
  asset: string;
  entryAt: string;
  side: string;
  setupFamily: string;
  result: {
    exitReason?: string;
    r: number | null;
  };
  readerState?: {
    regime?: string | null;
    auctionLocation?: string | null;
    auctionLevelKind?: string | null;
    auctionMode?: string | null;
    auctionPhase?: string | null;
  };
  absorptionQuality?: {
    quality?: string | null;
    side?: string | null;
    targetMovesTowardPoc?: boolean | null;
    evidence?: {
      absorption?: string | null;
      print?: string | null;
      followThrough?: string | null;
    };
  };
  narrative?: {
    intent?: string | null;
    direction?: string | null;
    verdict?: string | null;
    invalidatingEvidence?: string[];
  };
  vp?: {
    auction?: string | null;
    poc?: string | null;
    value?: string | null;
  };
  orderflow?: {
    pressure?: string | null;
    events?: string[];
    initiative?: {
      side?: string | null;
      conviction?: string | null;
    };
    evidence?: {
      pressure?: string | null;
      absorption?: string | null;
      print?: string | null;
      followThrough?: string | null;
    };
    tape?: {
      buyShare?: number | null;
      deltaShare?: number | null;
      dominantShare?: number | null;
      largestTradeShare?: number | null;
      lastTradeRank?: number | null;
      priceChange?: number | null;
    };
  };
  diagnostics?: {
    firstReaction?: string | null;
    firstReactionR?: number | null;
    observedMfeR?: number | null;
    observedMaeR?: number | null;
    entryTiming?: string | null;
    pocRotation?: string | null;
    labels?: string[];
  };
  dossierVerdict?: string | null;
  formationTransition?: {
    beforeEntry: FormationRead | null;
    firstPricedAfterEntry: FormationRead | null;
  };
};

type FormationRead = {
  stance?: string | null;
  lastPrice?: number | null;
  narrative?: {
    intent?: string | null;
    direction?: string | null;
    participation?: string | null;
    levelStory?: string | null;
  } | null;
  auction?: {
    location?: string | null;
    levelKind?: string | null;
    poc?: number | null;
  } | null;
  vp?: {
    auction?: string | null;
    poc?: string | null;
    value?: string | null;
  } | null;
  absorptionQuality?: {
    quality?: string | null;
    side?: string | null;
    targetMovesTowardPoc?: boolean | null;
  } | null;
  orderflow?: {
    pressure?: string | null;
    events?: string[];
    delta?: number | null;
    largestTradeSide?: string | null;
    initiative?: {
      side?: string | null;
      conviction?: string | null;
    } | null;
    tape?: {
      buyShare?: number | null;
      sellShare?: number | null;
      deltaShare?: number | null;
      dominantShare?: number | null;
      largestTradeShare?: number | null;
      lastTradeRank?: number | null;
      priceChange?: number | null;
    } | null;
  } | null;
};

type TradeRow = {
  trade: ReaderTrade;
  netR: number;
};

type Group = {
  key: string;
  trades: number;
  wins: number;
  losses: number;
  totalR: number;
  averageR: number;
  maxDrawdownR: number;
  adverseFirst: number;
  confirmedNarrative: number;
  refs: string[];
};

type Avoidance = {
  groupKey: string;
  skippedTrades: number;
  skippedR: number;
  keptTrades: number;
  keptWins: number;
  keptLosses: number;
  keptTotalR: number;
  keptAverageR: number;
  keptMaxDrawdownR: number;
  keptWinRate: number;
  refs: string[];
};

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const tapePaths = await tapePathsForInput();
const out = arg("out");
const costRPerTrade = costRPerTradeFor({
  riskPct: numberArg("risk-pct", 0),
  feePct: numberArg("fee-pct", 0),
  slippagePct: numberArg("slippage-pct", 0),
});

if (tapePaths.length === 0) throw new Error("--tapes or --tape-dir must include one or more trade-tape JSON paths");

const trades = (await Promise.all(tapePaths.map(readTape)))
  .flatMap((tape) => tape.assets.flatMap((asset) => asset.trades))
  .filter((trade) => trade.result.r !== null)
  .map((trade): TradeRow => ({ trade, netR: round((trade.result.r ?? 0) - costRPerTrade) }))
  .sort((left, right) => Date.parse(left.trade.entryAt) - Date.parse(right.trade.entryAt));

const report = {
  summary: summarizeRows("all", trades),
  byResultShape: grouped(trades, resultShapeKeyFor),
  byNarrativeState: grouped(trades, narrativeStateKeyFor),
  byReaderState: grouped(trades, readerStateKeyFor),
  byExecutionRead: grouped(trades, executionReadKeyFor),
  byMicrostructure: grouped(trades, microstructureKeyFor),
  byEntryReaderDecision: grouped(trades, entryReaderDecisionKeyFor),
  byPocDecisionContext: grouped(trades, pocDecisionContextKeyFor),
  byBeforeEntryRead: grouped(trades, beforeEntryReadKeyFor),
  byFormationTransition: grouped(trades, formationTransitionKeyFor),
  byFirstPricedRead: grouped(trades, firstPricedReadKeyFor),
  avoidance: {
    resultShape: avoidanceFor(trades, resultShapeKeyFor),
    narrativeState: avoidanceFor(trades, narrativeStateKeyFor),
    readerState: avoidanceFor(trades, readerStateKeyFor),
    executionRead: avoidanceFor(trades, executionReadKeyFor),
    entryReaderDecision: avoidanceFor(trades, entryReaderDecisionKeyFor),
    pocDecisionContext: avoidanceFor(trades, pocDecisionContextKeyFor),
    beforeEntryRead: avoidanceFor(trades, beforeEntryReadKeyFor),
    formationTransition: avoidanceFor(trades, formationTransitionKeyFor),
    firstPricedRead: avoidanceFor(trades, firstPricedReadKeyFor),
  },
  worstTrades: trades
    .slice()
    .sort((left, right) => left.netR - right.netR)
    .slice(0, 25)
    .map(tradeRefFor),
};

printReport(report);
if (out) await writeReport(out, report);

async function tapePathsForInput(): Promise<string[]> {
  const explicit = parseList(arg("tapes"));
  const tapeDir = arg("tape-dir");
  if (!tapeDir) return explicit;
  const pattern = arg("pattern", ".json") ?? ".json";
  const fromDir = (await readdir(tapeDir))
    .filter((name) => name.includes(pattern))
    .sort()
    .map((name) => join(tapeDir, name));
  return [...explicit, ...fromDir];
}

async function readTape(path: string): Promise<TradeTapeFile> {
  return JSON.parse(await readFile(path, "utf8")) as TradeTapeFile;
}

function grouped(rows: TradeRow[], keyFor: (row: TradeRow) => string): Group[] {
  const groups = new Map<string, TradeRow[]>();
  for (const row of rows) {
    const key = keyFor(row);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return [...groups.entries()]
    .map(([key, group]) => summarizeRows(key, group))
    .sort((left, right) => left.totalR - right.totalR || right.trades - left.trades);
}

function summarizeRows(key: string, rows: TradeRow[]): Group {
  const totalR = sum(rows.map((row) => row.netR));
  return {
    key,
    trades: rows.length,
    wins: rows.filter((row) => row.netR > 0).length,
    losses: rows.filter((row) => row.netR <= 0).length,
    totalR: round(totalR),
    averageR: rows.length === 0 ? 0 : round(totalR / rows.length),
    maxDrawdownR: maxDrawdown(rows.map((row) => row.netR)),
    adverseFirst: rows.filter((row) => row.trade.diagnostics?.firstReaction === "adverse-first-read").length,
    confirmedNarrative: rows.filter((row) => row.trade.narrative?.verdict === "confirmed").length,
    refs: rows.slice(0, 12).map(tradeRefFor),
  };
}

function avoidanceFor(rows: TradeRow[], keyFor: (row: TradeRow) => string): Avoidance[] {
  const groups = new Map<string, TradeRow[]>();
  for (const row of rows) {
    const key = keyFor(row);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return [...groups.entries()]
    .map(([key, group]) => avoidanceRowFor(key, rows, group))
    .sort((left, right) => right.keptTotalR - left.keptTotalR || right.keptTrades - left.keptTrades);
}

function avoidanceRowFor(key: string, allRows: TradeRow[], skippedRows: TradeRow[]): Avoidance {
  const skipped = new Set(skippedRows);
  const kept = allRows.filter((row) => !skipped.has(row));
  const keptTotalR = sum(kept.map((row) => row.netR));
  const skippedR = sum(skippedRows.map((row) => row.netR));
  const keptWins = kept.filter((row) => row.netR > 0).length;
  const keptLosses = kept.filter((row) => row.netR <= 0).length;
  return {
    groupKey: key,
    skippedTrades: skippedRows.length,
    skippedR: round(skippedR),
    keptTrades: kept.length,
    keptWins,
    keptLosses,
    keptTotalR: round(keptTotalR),
    keptAverageR: kept.length === 0 ? 0 : round(keptTotalR / kept.length),
    keptMaxDrawdownR: maxDrawdown(kept.map((row) => row.netR)),
    keptWinRate: kept.length === 0 ? 0 : round(keptWins / kept.length),
    refs: skippedRows.slice(0, 12).map(tradeRefFor),
  };
}

function resultShapeKeyFor(row: TradeRow): string {
  return [
    row.trade.diagnostics?.firstReaction ?? "unknown-reaction",
    row.trade.diagnostics?.entryTiming ?? "unknown-entry",
    row.trade.diagnostics?.pocRotation ?? "unknown-poc-rotation",
    row.trade.narrative?.verdict ?? "unknown-verdict",
  ].join("|");
}

function narrativeStateKeyFor(row: TradeRow): string {
  const narrative = row.trade.narrative;
  const invalidation = narrative?.invalidatingEvidence?.length ? narrative.invalidatingEvidence.join("+") : "no-invalidation";
  return [
    narrative?.intent ?? "unknown-intent",
    narrative?.direction ?? "unknown-direction",
    narrative?.verdict ?? "unknown-verdict",
    invalidation,
  ].join("|");
}

function readerStateKeyFor(row: TradeRow): string {
  const state = row.trade.readerState;
  const vp = row.trade.vp;
  return [
    state?.regime ?? "unknown-regime",
    state?.auctionLocation ?? "unknown-location",
    state?.auctionLevelKind ?? "unknown-level",
    state?.auctionMode ?? "unknown-mode",
    state?.auctionPhase ?? "unknown-phase",
    vp?.auction ?? "unknown-vp-auction",
    vp?.poc ?? "unknown-vp-poc",
    vp?.value ?? "unknown-vp-value",
  ].join("|");
}

function executionReadKeyFor(row: TradeRow): string {
  const orderflow = row.trade.orderflow;
  const absorption = row.trade.absorptionQuality;
  return [
    orderflow?.pressure ?? "unknown-pressure",
    orderflow?.initiative?.conviction ?? "unknown-conviction",
    eventFamily(orderflow?.events ?? []),
    absorption?.quality ?? "unknown-absorption",
    absorption?.targetMovesTowardPoc ? "trap-targets-poc" : "no-trap-target",
  ].join("|");
}

function microstructureKeyFor(row: TradeRow): string {
  const evidence = row.trade.orderflow?.evidence;
  const absorption = row.trade.absorptionQuality?.evidence;
  return [
    evidence?.pressure ?? "unknown-pressure-evidence",
    evidence?.print ?? "unknown-print",
    evidence?.followThrough ?? "unknown-followthrough",
    absorption?.absorption ?? "unknown-absorption-evidence",
    absorption?.followThrough ?? "unknown-absorption-followthrough",
  ].join("|");
}

function entryReaderDecisionKeyFor(row: TradeRow): string {
  const state = row.trade.readerState;
  const vp = row.trade.vp;
  const orderflow = row.trade.orderflow;
  return [
    state?.regime ?? "unknown-regime",
    state?.auctionLocation ?? "unknown-location",
    state?.auctionMode ?? "unknown-mode",
    state?.auctionPhase ?? "unknown-phase",
    vp?.poc ?? "unknown-vp-poc",
    row.trade.diagnostics?.entryTiming ?? "unknown-entry",
    orderflow?.pressure ?? "unknown-pressure",
    orderflow?.initiative?.conviction ?? "unknown-conviction",
  ].join("|");
}

function pocDecisionContextKeyFor(row: TradeRow): string {
  const state = row.trade.readerState;
  const vp = row.trade.vp;
  return [
    state?.regime ?? "unknown-regime",
    state?.auctionLocation ?? "unknown-location",
    vp?.auction ?? "unknown-vp-auction",
    vp?.poc ?? "unknown-vp-poc",
    vp?.value ?? "unknown-vp-value",
    row.trade.diagnostics?.entryTiming ?? "unknown-entry",
  ].join("|");
}

function beforeEntryReadKeyFor(row: TradeRow): string {
  const before = row.trade.formationTransition?.beforeEntry ?? null;
  if (!before) return "no-before-entry-read";
  return [
    before.stance ?? "unknown-stance",
    before.narrative?.intent ?? "no-intent",
    before.narrative?.direction ?? "no-direction",
    before.auction?.location ?? "unknown-location",
    before.vp?.poc ?? "unknown-poc",
    before.orderflow?.pressure ?? "unknown-pressure",
    before.orderflow?.initiative?.conviction ?? "unknown-initiative",
    eventFamily(before.orderflow?.events ?? []),
  ].join("|");
}

function formationTransitionKeyFor(row: TradeRow): string {
  const before = row.trade.formationTransition?.beforeEntry ?? null;
  const first = row.trade.formationTransition?.firstPricedAfterEntry ?? null;
  if (!before || !first) return "no-transition";
  return [
    transitionValue(before.narrative?.intent, first.narrative?.intent, "intent"),
    transitionValue(before.narrative?.direction, first.narrative?.direction, "direction"),
    transitionValue(before.auction?.location, first.auction?.location, "location"),
    transitionValue(before.vp?.poc, first.vp?.poc, "poc"),
    transitionValue(before.orderflow?.pressure, first.orderflow?.pressure, "pressure"),
    transitionValue(before.orderflow?.initiative?.conviction, first.orderflow?.initiative?.conviction, "initiative"),
    transitionValue(eventFamily(before.orderflow?.events ?? []), eventFamily(first.orderflow?.events ?? []), "events"),
  ].join("|");
}

function firstPricedReadKeyFor(row: TradeRow): string {
  const first = row.trade.formationTransition?.firstPricedAfterEntry ?? null;
  if (!first) return "no-first-priced-read";
  return [
    first.narrative?.intent ?? "no-intent",
    first.narrative?.direction ?? "no-direction",
    first.auction?.location ?? "unknown-location",
    first.vp?.poc ?? "unknown-poc",
    first.orderflow?.pressure ?? "unknown-pressure",
    first.orderflow?.initiative?.conviction ?? "unknown-initiative",
    eventFamily(first.orderflow?.events ?? []),
  ].join("|");
}

function transitionValue(before: string | null | undefined, after: string | null | undefined, label: string): string {
  const left = before ?? `no-${label}`;
  const right = after ?? `no-${label}`;
  return left === right ? `${label}:${left}` : `${label}:${left}->${right}`;
}

function tradeRefFor(row: TradeRow): string {
  const trade = row.trade;
  return [
    trade.entryAt,
    `net=${r(row.netR)}`,
    `raw=${nullableR(trade.result.r)}`,
    trade.readerState?.regime ?? "unknown-regime",
    trade.readerState?.auctionLocation ?? "unknown-location",
    trade.narrative?.verdict ?? "unknown-verdict",
    trade.diagnostics?.firstReaction ?? "unknown-reaction",
    trade.diagnostics?.pocRotation ?? "unknown-poc-rotation",
  ].join(":");
}

function printReport(reportForPrint: typeof report): void {
  console.log("READER TRADE STATE PROFILE");
  printGroup("summary", reportForPrint.summary);
  printGroups("worst_result_shape", reportForPrint.byResultShape.slice(0, 12));
  printGroups("worst_narrative_state", reportForPrint.byNarrativeState.slice(0, 12));
  printGroups("worst_reader_state", reportForPrint.byReaderState.slice(0, 12));
  printGroups("worst_execution_read", reportForPrint.byExecutionRead.slice(0, 12));
  printGroups("worst_microstructure", reportForPrint.byMicrostructure.slice(0, 12));
  printGroups("worst_entry_reader_decision", reportForPrint.byEntryReaderDecision.slice(0, 12));
  printGroups("worst_poc_decision_context", reportForPrint.byPocDecisionContext.slice(0, 12));
  printGroups("worst_before_entry_read", reportForPrint.byBeforeEntryRead.slice(0, 12));
  printGroups("worst_formation_transition", reportForPrint.byFormationTransition.slice(0, 12));
  printGroups("worst_first_priced_read", reportForPrint.byFirstPricedRead.slice(0, 12));
  printAvoidance("best_avoid_result_shape", reportForPrint.avoidance.resultShape.slice(0, 8));
  printAvoidance("best_avoid_narrative_state", reportForPrint.avoidance.narrativeState.slice(0, 8));
  printAvoidance("best_avoid_reader_state", reportForPrint.avoidance.readerState.slice(0, 8));
  printAvoidance("best_avoid_execution_read", reportForPrint.avoidance.executionRead.slice(0, 8));
  printAvoidance("best_avoid_entry_reader_decision", reportForPrint.avoidance.entryReaderDecision.slice(0, 8));
  printAvoidance("best_avoid_poc_decision_context", reportForPrint.avoidance.pocDecisionContext.slice(0, 8));
  printAvoidance("best_avoid_before_entry_read", reportForPrint.avoidance.beforeEntryRead.slice(0, 8));
  printAvoidance("best_avoid_formation_transition", reportForPrint.avoidance.formationTransition.slice(0, 8));
  printAvoidance("best_avoid_first_priced_read", reportForPrint.avoidance.firstPricedRead.slice(0, 8));
  console.log("worst_trades");
  for (const ref of reportForPrint.worstTrades.slice(0, 15)) console.log(ref);
}

function printGroups(title: string, rows: Group[]): void {
  console.log(title);
  for (const row of rows) printGroup(row.key, row);
}

function printGroup(label: string, group: Group): void {
  console.log(`${label} trades=${group.trades} W/L=${group.wins}/${group.losses} net=${r(group.totalR)} avg=${r(group.averageR)} maxDD=${r(group.maxDrawdownR)} adverseFirst=${group.adverseFirst} confirmed=${group.confirmedNarrative}`);
}

function printAvoidance(title: string, rows: Avoidance[]): void {
  console.log(title);
  for (const row of rows) {
    console.log(`${row.groupKey} skipped=${row.skippedTrades} skippedR=${r(row.skippedR)} kept=${row.keptTrades} W/L=${row.keptWins}/${row.keptLosses} keptNet=${r(row.keptTotalR)} keptAvg=${r(row.keptAverageR)} keptMaxDD=${r(row.keptMaxDrawdownR)} keptWinRate=${pct(row.keptWinRate)}`);
  }
}

async function writeReport(path: string, reportForWrite: typeof report): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path.replace(/\.md$/i, ".json"), `${JSON.stringify(reportForWrite, null, 2)}\n`, "utf8");
  await writeFile(path, markdownFor(reportForWrite), "utf8");
  console.log(`reader_trade_state_profile=${path}`);
}

function markdownFor(reportForMarkdown: typeof report): string {
  return [
    "# Reader Trade State Profile",
    "",
    `Cost per trade: ${r(costRPerTrade)}`,
    "",
    tableFor("Summary", [reportForMarkdown.summary]),
    tableFor("Worst Result Shape", reportForMarkdown.byResultShape.slice(0, 20)),
    tableFor("Worst Narrative State", reportForMarkdown.byNarrativeState.slice(0, 20)),
    tableFor("Worst Reader State", reportForMarkdown.byReaderState.slice(0, 20)),
    tableFor("Worst Execution Read", reportForMarkdown.byExecutionRead.slice(0, 20)),
    tableFor("Worst Microstructure", reportForMarkdown.byMicrostructure.slice(0, 20)),
    tableFor("Worst Entry Reader Decision", reportForMarkdown.byEntryReaderDecision.slice(0, 20)),
    tableFor("Worst POC Decision Context", reportForMarkdown.byPocDecisionContext.slice(0, 20)),
    tableFor("Worst Before Entry Read", reportForMarkdown.byBeforeEntryRead.slice(0, 20)),
    tableFor("Worst Formation Transition", reportForMarkdown.byFormationTransition.slice(0, 20)),
    tableFor("Worst First Priced Read", reportForMarkdown.byFirstPricedRead.slice(0, 20)),
    avoidanceTableFor("Best Avoid Result Shape", reportForMarkdown.avoidance.resultShape.slice(0, 20)),
    avoidanceTableFor("Best Avoid Narrative State", reportForMarkdown.avoidance.narrativeState.slice(0, 20)),
    avoidanceTableFor("Best Avoid Reader State", reportForMarkdown.avoidance.readerState.slice(0, 20)),
    avoidanceTableFor("Best Avoid Execution Read", reportForMarkdown.avoidance.executionRead.slice(0, 20)),
    avoidanceTableFor("Best Avoid Entry Reader Decision", reportForMarkdown.avoidance.entryReaderDecision.slice(0, 20)),
    avoidanceTableFor("Best Avoid POC Decision Context", reportForMarkdown.avoidance.pocDecisionContext.slice(0, 20)),
    avoidanceTableFor("Best Avoid Before Entry Read", reportForMarkdown.avoidance.beforeEntryRead.slice(0, 20)),
    avoidanceTableFor("Best Avoid Formation Transition", reportForMarkdown.avoidance.formationTransition.slice(0, 20)),
    avoidanceTableFor("Best Avoid First Priced Read", reportForMarkdown.avoidance.firstPricedRead.slice(0, 20)),
    "## Worst Trades",
    "",
    ...reportForMarkdown.worstTrades.map((ref) => `- ${ref}`),
    "",
  ].join("\n");
}

function avoidanceTableFor(title: string, rows: Avoidance[]): string {
  return [
    `## ${title}`,
    "",
    "| Skipped Key | Skipped | Skipped R | Kept Trades | Kept W/L | Kept Win Rate | Kept Net R | Kept Avg R | Kept Max DD | Skipped Refs |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...rows.map((row) => `| ${escapeTable(row.groupKey)} | ${row.skippedTrades} | ${r(row.skippedR)} | ${row.keptTrades} | ${row.keptWins}/${row.keptLosses} | ${pct(row.keptWinRate)} | ${r(row.keptTotalR)} | ${r(row.keptAverageR)} | ${r(row.keptMaxDrawdownR)} | ${escapeTable(row.refs.join(", "))} |`),
    "",
  ].join("\n");
}

function tableFor(title: string, rows: Group[]): string {
  return [
    `## ${title}`,
    "",
    "| Key | Trades | W/L | Net R | Avg R | Max DD | Adverse First | Confirmed | Refs |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...rows.map((row) => `| ${escapeTable(row.key)} | ${row.trades} | ${row.wins}/${row.losses} | ${r(row.totalR)} | ${r(row.averageR)} | ${r(row.maxDrawdownR)} | ${row.adverseFirst} | ${row.confirmedNarrative} | ${escapeTable(row.refs.join(", "))} |`),
    "",
  ].join("\n");
}

function parseList(value: string | undefined): string[] {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function numberArg(name: string, fallback: number): number {
  const value = arg(name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`--${name} must be a finite number`);
  return parsed;
}

function costRPerTradeFor(input: { riskPct: number; feePct: number; slippagePct: number }): number {
  if (input.feePct === 0 && input.slippagePct === 0) return 0;
  if (input.riskPct <= 0) throw new Error("--risk-pct is required and must be positive when fee/slippage costs are provided");
  return (input.feePct + input.slippagePct) / input.riskPct;
}

function eventFamily(events: string[]): string {
  return events.length === 0 ? "no-event" : [...events].sort().join("+");
}

function maxDrawdown(values: number[]): number {
  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  for (const value of values) {
    equity += value;
    peak = Math.max(peak, equity);
    maxDd = Math.min(maxDd, equity - peak);
  }
  return round(maxDd);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function round(value: number): number {
  const rounded = Math.round(value * 10_000) / 10_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function r(value: number): string {
  return `${value.toFixed(4).replace(/\.?0+$/, "")}R`;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}

function nullableR(value: number | null): string {
  return value === null ? "n/a" : r(value);
}

function escapeTable(value: string): string {
  return value.replaceAll("|", "\\|");
}

