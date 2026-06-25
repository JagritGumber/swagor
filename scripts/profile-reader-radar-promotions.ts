import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

type RadarUpdatesFile = {
  assets: Array<{
    asset: string;
    updates: Array<{
      promoted: boolean;
      candidate: RadarCandidate | null;
    }>;
  }>;
};

type RadarCandidate = {
  asset: string;
  updatedAt: number;
  readCount: number;
  favorableReads: number;
  adverseReads: number;
  repairReads: number;
  invalidationEvidence: string[];
  pocRotation: string;
  bestMove: number;
  worstMove: number;
  lastReason: string;
  candidate: {
    family: string;
    side: string | null;
    reader: {
      regime?: string | null;
      auctionLocation?: string | null;
      auctionLevelKind?: string | null;
      auctionMode?: string | null;
      auctionPhase?: string | null;
      vpAuction?: string | null;
      vpPoc?: string | null;
      vpValue?: string | null;
      localRangeLocation?: string | null;
      narrativeIntent?: string | null;
    };
    orderflow: {
      pressure?: string | null;
      events?: string[];
      largestTradeSide?: string | null;
    };
  };
};

type TradeTapeFile = {
  assets: Array<{
    trades: Array<{
      asset: string;
      entryAt: string;
      result: { r: number | null };
      diagnostics?: { firstReaction?: string | null };
      narrative?: { verdict?: string | null };
    }>;
  }>;
};

type Promotion = {
  at: string;
  candidate: RadarCandidate;
  tradeR: number | null;
  netR: number | null;
  firstReaction: string | null;
  narrativeVerdict: string | null;
};

type Group = {
  key: string;
  promotions: number;
  linkedTrades: number;
  wins: number;
  losses: number;
  totalR: number;
  averageR: number;
  refs: string[];
};

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const updatePaths = await pathsForInput("updates", "updates-dir");
const tradePaths = await pathsForInput("trade-tapes", "trade-tape-dir");
const costRPerTrade = costRPerTradeFor({
  riskPct: numberArg("risk-pct", 0),
  feePct: numberArg("fee-pct", 0),
  slippagePct: numberArg("slippage-pct", 0),
});
const minLinkPct = optionalNumberArg("min-link-pct");
const out = arg("out");

if (updatePaths.length === 0) throw new Error("--updates or --updates-dir must include radar update JSON paths");

const tradeByEntry = await tradeIndexFor(tradePaths);
const promotions = (await Promise.all(updatePaths.map(readUpdates)))
  .flatMap((file) => file.assets.flatMap((asset) => asset.updates))
  .filter((update) => update.promoted && update.candidate !== null)
  .map((update) => promotionFor(update.candidate!, tradeByEntry));

const report = {
  summary: summarize(promotions),
  byRepairState: grouped(promotions, repairStateKeyFor),
  byReaderState: grouped(promotions, readerStateKeyFor),
  byOutcomeState: grouped(promotions, outcomeStateKeyFor),
  unmatchedPromotions: promotions
    .filter((promotion) => promotion.netR === null)
    .slice(0, 50)
    .map(unmatchedPromotionFor),
};

if (minLinkPct !== undefined && report.summary.linkPct < minLinkPct) {
  throw new Error(`promotion/trade link coverage ${pct(report.summary.linkPct)} is below --min-link-pct ${pct(minLinkPct)}`);
}

printReport(report);
if (out) await writeReport(out, report);

async function pathsForInput(fileArg: string, dirArg: string): Promise<string[]> {
  const explicit = parseList(arg(fileArg));
  const dir = arg(dirArg);
  if (!dir) return explicit;
  const pattern = arg("pattern", ".json") ?? ".json";
  const fromDir = (await readdir(dir))
    .filter((name) => name.includes(pattern))
    .sort()
    .map((name) => join(dir, name));
  return [...explicit, ...fromDir];
}

async function readUpdates(path: string): Promise<RadarUpdatesFile> {
  return JSON.parse(await readFile(path, "utf8")) as RadarUpdatesFile;
}

async function tradeIndexFor(paths: string[]): Promise<Map<string, TradeTapeFile["assets"][number]["trades"][number]>> {
  const index = new Map<string, TradeTapeFile["assets"][number]["trades"][number]>();
  for (const path of paths) {
    const tape = JSON.parse(await readFile(path, "utf8")) as TradeTapeFile;
    for (const asset of tape.assets) {
      for (const trade of asset.trades) index.set(`${trade.asset}|${trade.entryAt}`, trade);
    }
  }
  return index;
}

function promotionFor(
  candidate: RadarCandidate,
  tradeByEntry: Map<string, TradeTapeFile["assets"][number]["trades"][number]>,
): Promotion {
  const at = new Date(candidate.updatedAt).toISOString();
  const trade = tradeByEntry.get(`${candidate.asset}|${at}`) ?? null;
  const tradeR = trade?.result.r ?? null;
  return {
    at,
    candidate,
    tradeR,
    netR: tradeR === null ? null : round(tradeR - costRPerTrade),
    firstReaction: trade?.diagnostics?.firstReaction ?? null,
    narrativeVerdict: trade?.narrative?.verdict ?? null,
  };
}

function summarize(items: Promotion[]) {
  const linked = items.filter((item) => item.netR !== null);
  const linkPct = items.length === 0 ? 1 : linked.length / items.length;
  return {
    promotions: items.length,
    linkedTrades: linked.length,
    unmatchedPromotions: items.length - linked.length,
    linkPct: round(linkPct),
    adverseBeforeEntry: items.filter((item) => item.candidate.adverseReads > 0).length,
    unrepairedAdverse: items.filter((item) => item.candidate.adverseReads > 0 && item.candidate.repairReads === 0).length,
    withInvalidationEvidence: items.filter((item) => item.candidate.invalidationEvidence.length > 0).length,
    wins: linked.filter((item) => (item.netR ?? 0) > 0).length,
    losses: linked.filter((item) => (item.netR ?? 0) <= 0).length,
    totalR: round(sum(linked.map((item) => item.netR ?? 0))),
    costRPerTrade: round(costRPerTrade),
  };
}

function unmatchedPromotionFor(item: Promotion) {
  return {
    at: item.at,
    key: readerStateKeyFor(item),
    repairState: repairStateKeyFor(item),
    reason: item.candidate.lastReason,
  };
}

function grouped(items: Promotion[], keyFor: (item: Promotion) => string): Group[] {
  const groups = new Map<string, Promotion[]>();
  for (const item of items) {
    const key = keyFor(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return [...groups.entries()]
    .map(([key, group]) => groupFor(key, group))
    .sort((left, right) => left.totalR - right.totalR || right.promotions - left.promotions);
}

function groupFor(key: string, items: Promotion[]): Group {
  const linked = items.filter((item) => item.netR !== null);
  const totalR = sum(linked.map((item) => item.netR ?? 0));
  return {
    key,
    promotions: items.length,
    linkedTrades: linked.length,
    wins: linked.filter((item) => (item.netR ?? 0) > 0).length,
    losses: linked.filter((item) => (item.netR ?? 0) <= 0).length,
    totalR: round(totalR),
    averageR: linked.length === 0 ? 0 : round(totalR / linked.length),
    refs: items.slice(0, 12).map((item) => `${item.at}:${item.tradeR ?? "no-trade"}->${item.netR ?? "n/a"}`),
  };
}

function repairStateKeyFor(item: Promotion): string {
  const candidate = item.candidate;
  return [
    `adverse=${candidate.adverseReads}`,
    `repair=${candidate.repairReads}`,
    `invalidation=${candidate.invalidationEvidence.length}`,
    `poc=${candidate.pocRotation}`,
  ].join("|");
}

function readerStateKeyFor(item: Promotion): string {
  const candidate = item.candidate;
  const reader = candidate.candidate.reader;
  return [
    reader.regime ?? "unknown",
    reader.auctionLocation ?? "unknown",
    reader.auctionLevelKind ?? "level",
    reader.auctionMode ?? "unknown",
    reader.auctionPhase ?? "unknown",
    reader.vpPoc ?? "unknown",
    reader.localRangeLocation ?? "unknown",
    candidate.candidate.orderflow.pressure ?? "unknown",
    eventFamily(candidate.candidate.orderflow.events ?? []),
  ].join("|");
}

function outcomeStateKeyFor(item: Promotion): string {
  return [
    item.firstReaction ?? "no-linked-trade",
    item.narrativeVerdict ?? "no-linked-trade",
  ].join("|");
}

function printReport(reportForPrint: typeof report): void {
  console.log("READER RADAR PROMOTION PROFILE");
  console.log(`promotions=${reportForPrint.summary.promotions} linkedTrades=${reportForPrint.summary.linkedTrades} unmatched=${reportForPrint.summary.unmatchedPromotions} linkPct=${pct(reportForPrint.summary.linkPct)} adverseBefore=${reportForPrint.summary.adverseBeforeEntry} unrepairedAdverse=${reportForPrint.summary.unrepairedAdverse} invalidationEvidence=${reportForPrint.summary.withInvalidationEvidence} net=${r(reportForPrint.summary.totalR)} cost=${r(reportForPrint.summary.costRPerTrade)}`);
  if (reportForPrint.summary.unmatchedPromotions > 0) {
    console.log(`unmatched_sample=${reportForPrint.unmatchedPromotions.map((item) => item.at).join(",")}`);
  }
  printGroups("by_repair_state", reportForPrint.byRepairState);
  printGroups("by_outcome_state", reportForPrint.byOutcomeState);
  printGroups("worst_reader_state", reportForPrint.byReaderState.slice(0, 12));
}

function printGroups(title: string, rows: Group[]): void {
  console.log(title);
  for (const row of rows) {
    console.log(`${row.key} promotions=${row.promotions} linked=${row.linkedTrades} W/L=${row.wins}/${row.losses} net=${r(row.totalR)} avg=${r(row.averageR)}`);
  }
}

async function writeReport(path: string, reportForWrite: typeof report): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path.replace(/\.md$/i, ".json"), `${JSON.stringify(reportForWrite, null, 2)}\n`, "utf8");
  await writeFile(path, markdownFor(reportForWrite), "utf8");
  console.log(`radar_promotion_profile=${path}`);
}

function markdownFor(reportForMarkdown: typeof report): string {
  return [
    "# Reader Radar Promotion Profile",
    "",
    `Promotions: ${reportForMarkdown.summary.promotions}`,
    `Linked trades: ${reportForMarkdown.summary.linkedTrades}`,
    `Unmatched promotions: ${reportForMarkdown.summary.unmatchedPromotions}`,
    `Link coverage: ${pct(reportForMarkdown.summary.linkPct)}`,
    `Adverse before entry: ${reportForMarkdown.summary.adverseBeforeEntry}`,
    `Unrepaired adverse: ${reportForMarkdown.summary.unrepairedAdverse}`,
    `Invalidation evidence: ${reportForMarkdown.summary.withInvalidationEvidence}`,
    `Net R: ${r(reportForMarkdown.summary.totalR)}`,
    `Cost per trade: ${r(reportForMarkdown.summary.costRPerTrade)}`,
    "",
    unmatchedTableFor(reportForMarkdown.unmatchedPromotions),
    tableFor("Repair State", reportForMarkdown.byRepairState),
    tableFor("Outcome State", reportForMarkdown.byOutcomeState),
    tableFor("Worst Reader State", reportForMarkdown.byReaderState.slice(0, 20)),
  ].join("\n");
}

function unmatchedTableFor(rows: ReturnType<typeof unmatchedPromotionFor>[]): string {
  return [
    "## Unmatched Promotions",
    "",
    "| At | Repair State | Reader State | Reason |",
    "| --- | --- | --- | --- |",
    ...(rows.length === 0
      ? ["| none | none | none | none |"]
      : rows.map((row) => `| ${row.at} | ${escapeTable(row.repairState)} | ${escapeTable(row.key)} | ${escapeTable(row.reason)} |`)),
    "",
  ].join("\n");
}

function tableFor(title: string, rows: Group[]): string {
  return [
    `## ${title}`,
    "",
    "| Key | Promotions | Linked | W/L | Net R | Avg R | Refs |",
    "| --- | ---: | ---: | ---: | ---: | ---: | --- |",
    ...rows.map((row) => `| ${escapeTable(row.key)} | ${row.promotions} | ${row.linkedTrades} | ${row.wins}/${row.losses} | ${r(row.totalR)} | ${r(row.averageR)} | ${escapeTable(row.refs.join(", "))} |`),
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

function optionalNumberArg(name: string): number | undefined {
  const value = arg(name);
  if (value === undefined) return undefined;
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

function escapeTable(value: string): string {
  return value.replaceAll("|", "\\|");
}

