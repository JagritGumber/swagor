import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

type TradeTapeFile = {
  assets: Array<{
    trades: ReaderTrade[];
  }>;
};

type ReaderTrade = {
  entryAt: string;
  side: "long" | "short";
  trust?: boolean;
  trustReason?: string;
  result: {
    entryPrice: number;
    stop: number;
    target: number;
    r: number | null;
  };
  readerState?: {
    regime?: string | null;
    auctionLocation?: string | null;
    auctionLevelKind?: string | null;
    auctionMode?: string | null;
    auctionPhase?: string | null;
  };
  vp?: {
    auction?: string | null;
    poc?: string | null;
    value?: string | null;
  };
  orderflow?: {
    pressure?: string | null;
  };
  narrative?: {
    participation?: string | null;
    verdict?: string | null;
  };
  diagnostics?: {
    firstReaction?: string | null;
    labels?: string[] | null;
  };
};

type ProfileRow = {
  key: string;
  trades: number;
  netWins: number;
  netLosses: number;
  grossR: number;
  netR: number;
  averageTargetR: number;
  entries: string[];
};

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const tapePaths = await tapePathsForInput();
const riskPct = numberArg("risk-pct", 0.25);
const feePct = numberArg("fee-pct", 0);
const slippagePct = numberArg("slippage-pct", 0);
const costR = riskPct > 0 ? (feePct + slippagePct) / riskPct : 0;
const out = arg("out");

if (tapePaths.length === 0) throw new Error("--tapes or --tape-dir must include one or more trade-tape JSON paths");

const tapes = await Promise.all(tapePaths.map(readTape));
const trades = tapes.flatMap((tape) => tape.assets.flatMap((asset) => asset.trades))
  .filter((trade) => (trade.trust ?? trade.trustReason === "judgeable") && trade.result.r !== null)
  .map(tradeEdgeFor)
  .filter((trade): trade is NonNullable<ReturnType<typeof tradeEdgeFor>> => trade !== null);

const report = {
  summary: summarize(trades),
  byTargetR: grouped(trades, (trade) => targetBucketFor(trade.targetR)),
  bySemanticState: grouped(trades, semanticKeyFor),
  netLosers: trades
    .filter((trade) => trade.netR <= 0)
    .sort((left, right) => left.netR - right.netR)
    .map((trade) => ({
      entryAt: trade.entryAt,
      grossR: trade.grossR,
      netR: trade.netR,
      targetR: trade.targetR,
      semanticKey: semanticKeyFor(trade),
    })),
};

printReport(report);
if (out) await writeReport(out, report);

function tradeEdgeFor(trade: ReaderTrade) {
  const targetR = targetRFor(trade);
  if (targetR === null || trade.result.r === null) return null;
  const grossR = trade.result.r;
  return {
    entryAt: trade.entryAt,
    grossR,
    netR: round(grossR - costR),
    targetR,
    trade,
  };
}

function targetRFor(trade: ReaderTrade): number | null {
  const risk = Math.abs(trade.result.entryPrice - trade.result.stop);
  if (!Number.isFinite(risk) || risk <= 0) return null;
  const reward = trade.side === "long"
    ? trade.result.target - trade.result.entryPrice
    : trade.result.entryPrice - trade.result.target;
  if (!Number.isFinite(reward) || reward <= 0) return null;
  return round(reward / risk);
}

function summarize(items: Array<NonNullable<ReturnType<typeof tradeEdgeFor>>>) {
  return {
    tapes: tapePaths.length,
    trades: items.length,
    netWins: items.filter((item) => item.netR > 0).length,
    netLosses: items.filter((item) => item.netR <= 0).length,
    grossR: round(sum(items.map((item) => item.grossR))),
    netR: round(sum(items.map((item) => item.netR))),
    costRPerTrade: round(costR),
    riskPct,
    feePct,
    slippagePct,
  };
}

function grouped(
  items: Array<NonNullable<ReturnType<typeof tradeEdgeFor>>>,
  keyFor: (item: NonNullable<ReturnType<typeof tradeEdgeFor>>) => string,
): ProfileRow[] {
  const groups = new Map<string, Array<NonNullable<ReturnType<typeof tradeEdgeFor>>>>();
  for (const item of items) {
    const key = keyFor(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      trades: group.length,
      netWins: group.filter((item) => item.netR > 0).length,
      netLosses: group.filter((item) => item.netR <= 0).length,
      grossR: round(sum(group.map((item) => item.grossR))),
      netR: round(sum(group.map((item) => item.netR))),
      averageTargetR: round(sum(group.map((item) => item.targetR)) / group.length),
      entries: group.map((item) => `${item.entryAt}:${item.grossR}->${item.netR}`),
    }))
    .sort((left, right) => left.netR - right.netR || right.trades - left.trades);
}

function semanticKeyFor(item: NonNullable<ReturnType<typeof tradeEdgeFor>>): string {
  const trade = item.trade;
  return [
    trade.readerState?.regime ?? "unknown",
    trade.readerState?.auctionLocation ?? "unknown",
    trade.readerState?.auctionLevelKind ?? "level",
    trade.readerState?.auctionMode ?? "unknown",
    trade.readerState?.auctionPhase ?? "unknown",
    trade.vp?.poc ?? "unknown",
    trade.orderflow?.pressure ?? "unknown",
    trade.narrative?.participation ?? "unknown",
    trade.diagnostics?.firstReaction ?? "unknown",
  ].join("|");
}

function targetBucketFor(targetR: number): string {
  if (targetR < 1) return "<1R";
  if (targetR < 2) return "1-2R";
  if (targetR < 4) return "2-4R";
  return "4R+";
}

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

function printReport(reportForPrint: typeof report): void {
  console.log("READER TRADE EDGE PROFILE");
  console.log(`trades=${reportForPrint.summary.trades} net=${r(reportForPrint.summary.netR)} gross=${r(reportForPrint.summary.grossR)} costR=${r(reportForPrint.summary.costRPerTrade)} netW/L=${reportForPrint.summary.netWins}/${reportForPrint.summary.netLosses}`);
  printRows("by_target_r", reportForPrint.byTargetR);
  printRows("worst_semantic_states", reportForPrint.bySemanticState.slice(0, 12));
}

function printRows(title: string, rows: ProfileRow[]): void {
  console.log(title);
  for (const row of rows) {
    console.log(`${row.key} trades=${row.trades} netW/L=${row.netWins}/${row.netLosses} gross=${r(row.grossR)} net=${r(row.netR)} avgTarget=${r(row.averageTargetR)}`);
  }
}

async function writeReport(path: string, reportForWrite: typeof report): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path.replace(/\.md$/i, ".json"), `${JSON.stringify(reportForWrite, null, 2)}\n`, "utf8");
  await writeFile(path, markdownFor(reportForWrite), "utf8");
  console.log(`reader_trade_edge_profile=${path}`);
}

function markdownFor(reportForMarkdown: typeof report): string {
  return [
    "# Reader Trade Edge Profile",
    "",
    `Trades: ${reportForMarkdown.summary.trades}`,
    `Gross R: ${r(reportForMarkdown.summary.grossR)}`,
    `Net R: ${r(reportForMarkdown.summary.netR)}`,
    `Cost per trade: ${r(reportForMarkdown.summary.costRPerTrade)}`,
    `Net W/L: ${reportForMarkdown.summary.netWins}/${reportForMarkdown.summary.netLosses}`,
    "",
    tableFor("Target R Buckets", reportForMarkdown.byTargetR),
    tableFor("Worst Semantic States", reportForMarkdown.bySemanticState.slice(0, 20)),
  ].join("\n");
}

function tableFor(title: string, rows: ProfileRow[]): string {
  return [
    `## ${title}`,
    "",
    "| Key | Trades | Net W/L | Gross R | Net R | Avg Target R |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...rows.map((row) => `| ${escapeTable(row.key)} | ${row.trades} | ${row.netWins}/${row.netLosses} | ${r(row.grossR)} | ${r(row.netR)} | ${r(row.averageTargetR)} |`),
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

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function r(value: number): string {
  return `${value.toFixed(4).replace(/\.?0+$/, "")}R`;
}

function escapeTable(value: string): string {
  return value.replaceAll("|", "\\|");
}
