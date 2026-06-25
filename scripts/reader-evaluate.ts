import { runReaderReplayReport } from "../packages/strategy-lab/reader/reader-report/run-reader-replay-report";
import type { CandleInterval, HyperliquidNetwork } from "../packages/market-data";
import type { ReaderTradeDossier } from "../packages/strategy-lab/reader/reader-evidence/types";

const vmUrl = process.env.VM_URL ?? "http://localhost:8428";
const orderflowRootDir = process.env.ORDERFLOW_ROOT_DIR ?? "orderflow-data";
const network = (process.env.NETWORK ?? "mainnet") as HyperliquidNetwork;
const asset = process.env.ASSET ?? "BTC";
const interval = (process.env.INTERVAL ?? "5m") as CandleInterval;
const startMs = Number(process.env.START_MS ?? Date.parse("2026-05-27T14:00:00.000Z"));
const endMs = Number(process.env.END_MS ?? Date.parse("2026-05-27T22:21:00.000Z"));
const readIntervalMs = Number(process.env.READ_INTERVAL_MS ?? 60_000);
const orderflowWindowMs = Number(process.env.ORDERFLOW_WINDOW_MS ?? 300_000);
const setupTtlMs = Number(process.env.SETUP_TTL_MS ?? 900_000);

const report = await runReaderReplayReport({
  vmUrl,
  orderflowRootDir,
  network,
  asset,
  interval,
  startMs,
  endMs,
  readIntervalMs,
  orderflowWindowMs,
  setupTtlMs,
});

const trades = report.evidence.trades.map((trade, index) => tradeDossierSummary(trade, index + 1));

const evaluation = {
  run: {
    asset,
    interval,
    start: iso(startMs),
    end: iso(endMs),
    readIntervalMs,
    orderflowWindowMs,
    setupTtlMs,
  },
  data: {
    candles: report.diagnostics.candleCount,
    orderflowEvents: report.diagnostics.orderflowEventCount,
    firstOrderflowAt: nullableIso(report.diagnostics.firstOrderflowAt),
    lastOrderflowAt: nullableIso(report.diagnostics.lastOrderflowAt),
    reads: report.summary.totalReads,
  },
  registry: {
    registeredTrades: report.summary.totalEntries,
    closedTrades: report.summary.totalOutcomes,
    openTrade: report.open === null ? null : {
      side: report.open.side,
      entryAt: iso(report.open.entryAt),
      entryPrice: report.open.entryPrice,
      stop: report.open.stop,
      target: report.open.target,
    },
  },
  quality: {
    replayQuality: report.executionQuality.replayQuality,
    priceCoveragePct: report.executionQuality.priceCoveragePct,
    pricedReads: report.executionQuality.pricedReads,
    unpricedReads: report.executionQuality.unpricedReads,
    longestUnpricedGapMs: report.executionQuality.longestUnpricedGapMs,
  },
  trades,
  conclusion: conclusionFor(trades),
};

console.log(JSON.stringify(evaluation, null, 2));

function tradeDossierSummary(trade: ReaderTradeDossier, index: number) {
  const significantFormation = trade.formation.significantBeforeEntry.map((read) => ({
    at: iso(read.at),
    stance: read.stance,
    lastPrice: read.lastPrice,
    auction: read.auction.location,
    levelKind: read.auction.levelKind,
    levelPrice: read.auction.levelPrice,
    poc: read.auction.poc,
    orderflowPressure: read.orderflow.pressure,
    orderflowEvents: read.orderflow.events,
    setupEvents: read.setup.eventTypes,
    resultEvents: read.resultEventTypes,
  }));

  return {
    index,
    registered: true,
    verdict: trade.verdict,
    trade: {
      side: trade.trade.side,
      entryAt: iso(trade.trade.entryAt),
      entryPrice: trade.trade.entryPrice,
      stop: trade.trade.stop,
      target: trade.trade.target,
      exitAt: trade.trade.exitAt === undefined ? null : iso(trade.trade.exitAt),
      exitPrice: trade.trade.exitPrice ?? null,
      exitReason: trade.trade.exitReason ?? null,
      r: trade.trade.r ?? null,
    },
    readAtEntry: {
      setupKey: trade.setup.key,
      planSource: trade.setup.planSource,
      setupAgeMs: trade.setup.setupAgeMs,
      auctionLocation: trade.auction.location,
      auctionBias: trade.auction.bias,
      levelKind: trade.auction.level?.kind ?? null,
      levelPrice: trade.auction.level?.price ?? null,
      poc: trade.auction.profile?.poc ?? null,
      valueAreaLow: trade.auction.profile?.valueAreaLow ?? null,
      valueAreaHigh: trade.auction.profile?.valueAreaHigh ?? null,
      orderflowPressure: trade.orderflow.pressure,
      orderflowDelta: trade.orderflow.delta,
      orderflowTradeCount: trade.orderflow.tradeCount,
      orderflowEvents: trade.orderflow.events,
      reasons: trade.setup.reasons,
    },
    formation: {
      significantBeforeEntry: significantFormation,
      afterEntry: trade.formation.afterEntry.map((read) => ({
        at: iso(read.at),
        lastPrice: read.lastPrice,
        stance: read.stance,
        auction: read.auction.location,
        pressure: read.orderflow.pressure,
        orderflowEvents: read.orderflow.events,
        setupEvents: read.setup.eventTypes,
        resultEvents: read.resultEventTypes,
      })),
    },
    executionQuality: trade.execution,
    analysis: analysisForTrade(trade),
  };
}

function analysisForTrade(trade: ReaderTradeDossier): string[] {
  const notes: string[] = [];
  notes.push(`Registered ${trade.trade.side} at ${iso(trade.trade.entryAt)} from ${trade.auction.location} ${trade.auction.level?.kind ?? "no-level"} context.`);
  if (trade.orderflow.events.includes("stalled-selling")) {
    notes.push("Entry had seller-failure evidence: stalled-selling appeared in orderflow.");
  }
  if (trade.trade.exitReason !== undefined) {
    notes.push(`Replay closed the trade by ${trade.trade.exitReason} at ${trade.trade.exitPrice} for ${trade.trade.r}R.`);
  } else {
    notes.push("Replay left the trade open in this evaluation window.");
  }
  if (trade.execution.quality === "unusable") {
    notes.push(`Do not trust PnL: only ${trade.execution.coveragePctWhileOpen}% price coverage while open.`);
  }
  return notes;
}

function conclusionFor(trades: ReturnType<typeof tradeDossierSummary>[]): string {
  if (trades.length === 0) {
    return "No trades were registered in this evaluation window, so this run cannot judge entry quality.";
  }
  if (trades.every((trade) => trade.verdict === "result-unusable-price-coverage")) {
    return "Trades were registered and dossiers were created, but result quality is not trustworthy because execution price coverage is unusable.";
  }
  return "At least one registered trade has usable enough evidence for strategy review.";
}

function iso(time: number): string {
  return new Date(time).toISOString();
}

function nullableIso(time: number | null): string | null {
  return time === null ? null : iso(time);
}


