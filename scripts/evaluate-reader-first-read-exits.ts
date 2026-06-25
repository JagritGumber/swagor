import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

type TradeTapeFile = {
  assets: Array<{
    trades: ReaderTrade[];
  }>;
};

type ReaderTrade = {
  asset: string;
  entryAt: string;
  side: "long" | "short";
  result: {
    entryPrice: number;
    stop: number;
    exitReason?: string | null;
    r: number | null;
  };
  diagnostics?: {
    firstReaction?: string | null;
    pocRotation?: string | null;
  };
  formationTransition?: {
    beforeEntry: FormationRead | null;
    firstPricedAfterEntry: FormationRead | null;
  };
};

type FormationRead = {
  at?: string | null;
  lastPrice?: number | null;
  narrative?: {
    intent?: string | null;
    direction?: string | null;
  } | null;
  auction?: {
    location?: string | null;
    poc?: number | null;
  } | null;
  vp?: {
    poc?: string | null;
  } | null;
  orderflow?: {
    pressure?: string | null;
    events?: string[];
    initiative?: {
      side?: string | null;
      conviction?: string | null;
    } | null;
  } | null;
  resultEvents?: string[];
};

type TradeRow = {
  trade: ReaderTrade;
  baselineR: number;
  firstReadR: number | null;
};

type Policy = {
  key: string;
  description: string;
  shouldExitAtFirstRead: (row: TradeRow) => boolean;
};

type Summary = {
  trades: number;
  wins: number;
  losses: number;
  totalR: number;
  averageR: number;
  maxDrawdownR: number;
  changedTrades: number;
  changedR: number;
};

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const out = arg("out");
const costRPerTrade = costRPerTradeFor({
  riskPct: numberArg("risk-pct", 0),
  feePct: numberArg("fee-pct", 0),
  slippagePct: numberArg("slippage-pct", 0),
});

const rows = (await Promise.all((await tapePathsForInput()).map(readTape)))
  .flatMap((tape) => tape.assets.flatMap((asset) => asset.trades))
  .filter((trade) => trade.result.r !== null)
  .map((trade): TradeRow => ({
    trade,
    baselineR: round((trade.result.r ?? 0) - costRPerTrade),
    firstReadR: firstReadRFor(trade),
  }))
  .sort((left, right) => Date.parse(left.trade.entryAt) - Date.parse(right.trade.entryAt));

if (rows.length === 0) throw new Error("--tapes or --tape-dir must include trade tapes with judgeable trades");

const policies: Policy[] = [
  {
    key: "baseline",
    description: "Keep the current replay result.",
    shouldExitAtFirstRead: () => false,
  },
  {
    key: "reader-failure-event",
    description: "Exit when the first priced read itself emits reader-failure-exit.",
    shouldExitAtFirstRead: (row) => firstReadEvents(row).includes("reader-failure-exit"),
  },
  {
    key: "adverse-first-read",
    description: "Exit when the first priced read has already moved against the trade.",
    shouldExitAtFirstRead: (row) => (row.firstReadR ?? 0) < 0,
  },
  {
    key: "away-from-poc-first-read",
    description: "Exit when the first priced read moves farther away from POC than the entry read.",
    shouldExitAtFirstRead: movedAwayFromPocAtFirstRead,
  },
  {
    key: "adverse-or-away-from-poc",
    description: "Exit when the first priced read is adverse or moves away from POC.",
    shouldExitAtFirstRead: (row) => (row.firstReadR ?? 0) < 0 || movedAwayFromPocAtFirstRead(row),
  },
];

const evaluated = policies.map((policy) => ({
  policy,
  summary: summarize(rows, policy),
  byMonth: groupedByMonth(rows, policy),
  changedTrades: changedTrades(rows, policy).slice(0, 40),
}));

printReport(evaluated);
if (out) await writeReport(out, markdownFor(evaluated));

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

function summarize(inputRows: TradeRow[], policy: Policy): Summary {
  const values = inputRows.map((row) => rFor(row, policy));
  const changed = inputRows.filter((row) => changesTrade(row, policy));
  const changedR = sum(changed.map((row) => rFor(row, policy) - row.baselineR));
  return {
    trades: inputRows.length,
    wins: values.filter((value) => value > 0).length,
    losses: values.filter((value) => value <= 0).length,
    totalR: round(sum(values)),
    averageR: round(sum(values) / inputRows.length),
    maxDrawdownR: maxDrawdown(values),
    changedTrades: changed.length,
    changedR: round(changedR),
  };
}

function groupedByMonth(inputRows: TradeRow[], policy: Policy): Array<{ month: string; summary: Summary }> {
  const groups = new Map<string, TradeRow[]>();
  for (const row of inputRows) {
    const month = row.trade.entryAt.slice(0, 7);
    const group = groups.get(month);
    if (group) group.push(row);
    else groups.set(month, [row]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, group]) => ({ month, summary: summarize(group, policy) }));
}

function changedTrades(inputRows: TradeRow[], policy: Policy): string[] {
  return inputRows
    .filter((row) => changesTrade(row, policy))
    .map((row) => {
      const first = row.trade.formationTransition?.firstPricedAfterEntry ?? null;
      return [
        row.trade.entryAt,
        row.trade.side,
        `baseline=${formatR(row.baselineR)}`,
        `first=${formatR(rFor(row, policy))}`,
        `firstRead=${formatR(row.firstReadR)}`,
        `events=${(first?.resultEvents ?? []).join("+") || "none"}`,
        `poc=${movedAwayFromPocAtFirstRead(row) ? "away" : "not-away"}`,
        `intent=${first?.narrative?.intent ?? "unknown"}`,
        `pressure=${first?.orderflow?.pressure ?? "unknown"}`,
      ].join(" ");
    });
}

function rFor(row: TradeRow, policy: Policy): number {
  if (!policy.shouldExitAtFirstRead(row)) return row.baselineR;
  if (row.firstReadR === null) return row.baselineR;
  return round(row.firstReadR - costRPerTrade);
}

function changesTrade(row: TradeRow, policy: Policy): boolean {
  return policy.shouldExitAtFirstRead(row) && row.firstReadR !== null && rFor(row, policy) !== row.baselineR;
}

function firstReadRFor(trade: ReaderTrade): number | null {
  const firstPrice = trade.formationTransition?.firstPricedAfterEntry?.lastPrice;
  if (!finiteNumber(firstPrice)) return null;
  const risk = Math.abs(trade.result.entryPrice - trade.result.stop);
  if (!Number.isFinite(risk) || risk <= 0) return null;
  const move = trade.side === "long"
    ? firstPrice - trade.result.entryPrice
    : trade.result.entryPrice - firstPrice;
  return round(move / risk);
}

function movedAwayFromPocAtFirstRead(row: TradeRow): boolean {
  const before = row.trade.formationTransition?.beforeEntry;
  const after = row.trade.formationTransition?.firstPricedAfterEntry;
  if (!finiteNumber(before?.lastPrice) || !finiteNumber(after?.lastPrice)) return false;
  const poc = finiteNumber(after?.auction?.poc) ? after.auction.poc : before?.auction?.poc;
  if (!finiteNumber(poc)) return false;
  return Math.abs(after.lastPrice - poc) > Math.abs(before.lastPrice - poc);
}

function firstReadEvents(row: TradeRow): string[] {
  return row.trade.formationTransition?.firstPricedAfterEntry?.resultEvents ?? [];
}

function printReport(items: typeof evaluated): void {
  console.log("READER FIRST READ EXIT EVALUATION");
  console.log(`trades=${rows.length} costR=${formatR(costRPerTrade)}`);
  console.log("");
  for (const item of items) {
    console.log(`${item.policy.key}: ${summaryLine(item.summary)}`);
    console.log(`  ${item.policy.description}`);
  }
}

function markdownFor(items: typeof evaluated): string {
  return [
    "# Reader First Read Exit Evaluation",
    "",
    `Cost per trade: ${formatR(costRPerTrade)}`,
    "",
    "## Summary",
    "",
    "| Policy | Trades | W/L | Net R | Avg R | Max DD | Changed | Changed R | Description |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...items.map((item) => [
      item.policy.key,
      item.summary.trades,
      `${item.summary.wins}/${item.summary.losses}`,
      formatR(item.summary.totalR),
      formatR(item.summary.averageR),
      formatR(item.summary.maxDrawdownR),
      item.summary.changedTrades,
      formatR(item.summary.changedR),
      item.policy.description,
    ].join(" | ")).map((line) => `| ${line} |`),
    "",
    "## By Month",
    "",
    ...items.flatMap((item) => [
      `### ${item.policy.key}`,
      "",
      "| Month | Trades | W/L | Net R | Avg R | Max DD | Changed | Changed R |",
      "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
      ...item.byMonth.map(({ month, summary }) => `| ${month} | ${summary.trades} | ${summary.wins}/${summary.losses} | ${formatR(summary.totalR)} | ${formatR(summary.averageR)} | ${formatR(summary.maxDrawdownR)} | ${summary.changedTrades} | ${formatR(summary.changedR)} |`),
      "",
    ]),
    "## Changed Trades",
    "",
    ...items.flatMap((item) => [
      `### ${item.policy.key}`,
      "",
      ...(item.changedTrades.length === 0 ? ["none"] : item.changedTrades.map((trade) => `- ${trade}`)),
      "",
    ]),
  ].join("\n");
}

async function writeReport(path: string, text: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${text}\n`);
}

function costRPerTradeFor(input: { riskPct: number; feePct: number; slippagePct: number }): number {
  if (!Number.isFinite(input.riskPct) || input.riskPct <= 0) return 0;
  return round((input.feePct + input.slippagePct) / input.riskPct);
}

function numberArg(name: string, fallback: number): number {
  const raw = arg(name);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`--${name} must be numeric`);
  return parsed;
}

function parseList(value: string | undefined): string[] {
  return value === undefined ? [] : value.split(",").map((item) => item.trim()).filter(Boolean);
}

function maxDrawdown(values: number[]): number {
  let equity = 0;
  let peak = 0;
  let worst = 0;
  for (const value of values) {
    equity += value;
    peak = Math.max(peak, equity);
    worst = Math.min(worst, equity - peak);
  }
  return round(worst);
}

function summaryLine(summary: Summary): string {
  return `trades=${summary.trades} wins=${summary.wins} losses=${summary.losses} totalR=${formatR(summary.totalR)} avgR=${formatR(summary.averageR)} maxDD=${formatR(summary.maxDrawdownR)} changed=${summary.changedTrades} changedR=${formatR(summary.changedR)}`;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function round(value: number | null): number {
  if (value === null || !Number.isFinite(value)) return 0;
  return Math.round(value * 10_000) / 10_000;
}

function formatR(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${round(value).toFixed(4).replace(/\.?0+$/, "")}R`;
}


