import { runReaderReplayReport } from "../packages/strategy-lab/reader/reader-report/run-reader-replay-report";
import type { CandleInterval, HyperliquidNetwork } from "../packages/market-data";

const vmUrl = process.env.VM_URL ?? "http://localhost:8428";
const orderflowRootDir = process.env.ORDERFLOW_ROOT_DIR ?? "orderflow-data";
const network = (process.env.NETWORK ?? "mainnet") as HyperliquidNetwork;
const asset = process.env.ASSET ?? "BTC";
const interval = (process.env.INTERVAL ?? "5m") as CandleInterval;
const startMs = Number(process.env.START_MS ?? Date.parse("2026-05-27T00:00:00.000Z"));
const endMs = Number(process.env.END_MS ?? Date.parse("2026-05-28T00:00:00.000Z") - 1);
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

const compact = {
  input: {
    vmUrl,
    orderflowRootDir,
    network,
    asset,
    interval,
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    readIntervalMs,
    orderflowWindowMs,
    setupTtlMs,
  },
  diagnostics: {
    ...report.diagnostics,
    firstCandleAt: toIso(report.diagnostics.firstCandleAt),
    lastCandleAt: toIso(report.diagnostics.lastCandleAt),
    firstOrderflowAt: toIso(report.diagnostics.firstOrderflowAt),
    lastOrderflowAt: toIso(report.diagnostics.lastOrderflowAt),
  },
  summary: report.summary,
  executionQuality: report.executionQuality,
  openPosition: report.open,
  activeSetups: report.setupMemory.snapshot().map(({ value: setup }) => ({
    key: setup.key,
    asset: setup.asset,
    side: setup.side,
    status: setup.status,
    createdAt: toIso(setup.createdAt),
    updatedAt: toIso(setup.updatedAt),
    readCount: setup.readCount,
    lastReason: setup.lastReason,
  })),
  recentSetupEvents: report.setupEvents.slice(-10),
  recentResultEvents: report.resultState.events.slice(-10),
  evidence: {
    dataQuality: report.evidence.dataQuality,
    trades: report.evidence.trades,
  },
};

console.log(JSON.stringify(compact, null, 2));

function toIso(time: number | null): string | null {
  return time === null ? null : new Date(time).toISOString();
}

